const { google } = require('googleapis');
require('dotenv').config();
const { isMockDataEnabled } = require('./env');

const getGoogleAuth = () => {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    if (isMockDataEnabled()) {
      console.warn('Google Sheets credentials are missing; explicit development mock mode is enabled.');
      return null;
    }
    throw new Error('Google Sheets API credentials are not fully configured');
  }

  // Handle newline characters in private key from environment variables
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return auth;
  } catch (error) {
    if (isMockDataEnabled()) {
      console.warn('Google authentication initialization failed; using explicit development mock mode.');
      return null;
    }
    throw new Error(`Failed to initialize Google authentication: ${error.message}`);
  }
};

module.exports = {
  getGoogleAuth,
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
};
