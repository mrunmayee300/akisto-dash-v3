const { google } = require('googleapis');
require('dotenv').config();

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

console.log('Client Email:', clientEmail);
console.log('Spreadsheet ID:', spreadsheetId);

if (!clientEmail || !privateKey || !spreadsheetId) {
  console.error('Credentials or spreadsheet ID missing in backend/.env!');
  process.exit(1);
}

if (privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

const auth = new google.auth.JWT(
  clientEmail,
  null,
  privateKey,
  ['https://www.googleapis.com/auth/spreadsheets.readonly']
);

const sheets = google.sheets({ version: 'v4', auth });

sheets.spreadsheets.get({ spreadsheetId })
  .then(res => {
    console.log('Success! Connected to Spreadsheet.');
    console.log('Available Sheets:', res.data.sheets.map(s => s.properties.title));
  })
  .catch(err => {
    console.error('Error connecting to spreadsheet:', err.message);
  });
