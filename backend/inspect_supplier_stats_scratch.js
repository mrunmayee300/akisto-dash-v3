const sheetsService = require('./src/services/sheets.service');
require('dotenv').config();

async function run() {
  const data = await sheetsService.getMultipleSheetsObjects(['Communication Logs'], 'C3');
  const rows = data['Communication Logs'] || [];
  console.log('Total rows:', rows.length);
  if (rows.length > 0) {
    console.log('Keys of first row:');
    console.log(Object.keys(rows[0]));
    console.log('Sample row data:');
    console.log(JSON.stringify(rows[0], null, 2));
  }
}

run().catch(err => {
  console.error(err);
});
