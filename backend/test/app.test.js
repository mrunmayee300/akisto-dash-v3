const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.ALLOW_MOCK_DATA = 'true';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-at-least-32-bytes';
delete process.env.ALLOW_LEGACY_QUERY_AUTH;
delete process.env.ALLOW_LEGACY_PASSWORD_HASHES;
delete process.env.CACHE_ADMIN_TOKEN;

const { createApp } = require('../src/app');
const cacheService = require('../src/services/cache.service');
const authService = require('../src/services/auth.service');

const app = createApp();
let token;

before(async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      companyName: 'Demo Manufacturing',
      email: 'buyer@example.com',
      password: 'change-me-in-development',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  token = response.body.token;
});

after(() => cacheService.flush());

test('health endpoint is public', async () => {
  const response = await request(app).get('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('the legacy query-string login contract is not available', async () => {
  const response = await request(app)
    .get('/?action=login&companyName=Demo%20Manufacturing&email=buyer%40example.com&password=change-me-in-development');

  assert.equal(response.status, 200);
  assert.equal(response.body.name, 'Akisto API');
  assert.equal(response.body.token, undefined);
});

test('a protected route requires the Authorization header', async () => {
  const response = await request(app)
    .get(`/api/dashboard?sessionToken=${encodeURIComponent(token)}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Unauthorized');
});

test('invalid credentials receive a generic rejection', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      companyName: 'Demo Manufacturing',
      email: 'buyer@example.com',
      password: 'this-is-not-the-password',
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Invalid email, password, or company combination');
});

test('dashboard data is tenant scoped and available with a bearer token', async () => {
  const response = await request(app)
    .get('/api/dashboard')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.openPOs));
  assert.ok(response.body.openPOs.length > 0);
  assert.ok(response.body.openPOs.every(po => po.client_code === 'C1'));
});

test('concurrent dashboard requests complete without a two-user ceiling', async () => {
  cacheService.flush();
  const responses = await Promise.all(
    Array.from({ length: 20 }, () => request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`))
  );

  assert.ok(responses.every(response => response.status === 200));
  assert.ok(responses.every(response => response.body.success === true));
});

test('cache flush stays disabled when no separate admin token is configured', async () => {
  const response = await request(app)
    .post('/api/cache/flush')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 404);
});

test('supplier access fails closed when a regular user has no buyer mapping', async () => {
  const unmappedToken = authService.generateToken({
    user_id: 'unmapped-test-user',
    email: 'unmapped@example.com',
    client_code: 'C1',
    role: 'User',
    'User Name': 'Unmapped User',
    'Role': 'Buyer',
  });

  const response = await request(app)
    .get('/api/supplier')
    .set('Authorization', `Bearer ${unmappedToken}`);

  assert.equal(response.status, 403);
});

test('untrusted browser origins are rejected', async () => {
  const response = await request(app)
    .get('/health')
    .set('Origin', 'https://attacker.example');

  assert.equal(response.status, 403);
});
