const sheetsService = require('./src/services/sheets.service');

async function main() {
  try {
    const sessions = await sheetsService.getSheetObjects('Sessions');
    console.log("Sessions found (count=" + sessions.length + "):");
    sessions.forEach(s => {
      console.log(`- Token: ${s.token}, Email: ${s.email}, Client Code: ${s.client_code}, Expiry: ${s.expiry}`);
    });
  } catch (err) {
    console.error(err);
  }
}

main();
