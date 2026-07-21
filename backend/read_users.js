const { google } = require('googleapis');
require('dotenv').config();

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

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

sheets.spreadsheets.values.get({
  spreadsheetId,
  range: 'Users!A1:Z'
}).then(res => {
  const rows = res.data.values || [];
  console.log('Headers:', rows[0]);
  for (let i = 1; i < rows.length; i++) {
    console.log(`Row ${i}:`, rows[i]);
  }
}).catch(err => {
  console.error(err);
});
