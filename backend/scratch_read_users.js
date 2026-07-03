const sheetsService = require('./src/services/sheets.service');

async function main() {
  try {
    const users = await sheetsService.getSheetObjects('Users');
    console.log("Users found (count=" + users.length + "):");
    users.forEach(u => {
      console.log(`- Email: ${u.email}, Client Code: ${u.client_code}, Active: ${u.active}`);
    });

    const clients = await sheetsService.getSheetObjects('Client info');
    console.log("\nClients found (count=" + clients.length + "):");
    clients.forEach(c => {
      console.log(`- Code: ${c.client_code}, Full Name: ${c.client_company_name_full || c.company_name || c.client_company_name}`);
    });
  } catch (err) {
    console.error(err);
  }
}

main();
