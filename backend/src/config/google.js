const { google } = require('googleapis');
require('dotenv').config();

const getGoogleAuth = () => {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    console.warn('Google Sheets API credentials not fully configured. Backend will operate in fallback/mock mode.');
    return null;
  }

  // Handle newline characters in private key from environment variables
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  try {
    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    return auth;
  } catch (error) {
    console.error('Error initializing Google Auth JWT:', error);
    return null;
  }
};

module.exports = {
  getGoogleAuth,
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
};
