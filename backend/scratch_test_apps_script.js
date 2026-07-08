const http = require('https');

function getUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = res.headers.location;
        http.get(redirectUrl, (redirectRes) => {
          let data = '';
          redirectRes.on('data', (chunk) => { data += chunk; });
          redirectRes.on('end', () => resolve(JSON.parse(data)));
        });
      } else {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(JSON.parse(data)));
      }
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Logging in to get a fresh token...');
    const loginRes = await getUrl('https://script.google.com/macros/s/AKfycbwDYIGa38fQeS9qAMefASLOzSUlz14V4ElMjnEjZ3_0qwrzMZDNpauDZiwCHMUzM2sz/exec?action=login&companyName=Emerald&email=mrunmayeesangode@gmail.com&password=password123');
    console.log('Login Response:', loginRes);

    if (loginRes.success) {
      const token = loginRes.token;
      console.log('\nValidating session with token:', token);
      const validateRes = await getUrl(`https://script.google.com/macros/s/AKfycbwDYIGa38fQeS9qAMefASLOzSUlz14V4ElMjnEjZ3_0qwrzMZDNpauDZiwCHMUzM2sz/exec?action=dashboard&sessionToken=${encodeURIComponent(token)}`);
      console.log('Validation Response:', validateRes);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
