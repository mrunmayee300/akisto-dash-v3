const fetch = require('node-fetch'); // if node-fetch is not available we can use dynamic import or standard http, but wait, let's write a standard node http fetch
const https = require('https');

const url = 'https://script.google.com/macros/s/AKfycbwMKruoSC1A5Pl0kB1YbxdpF4dbCuFMHoSyh51tZ_q-U9qgAsAdxlMbq0lFP58U_YBC/exec?action=supplierPerformance&sessionToken=ffca9ed9-be49-4d81-b9a1-61dff756323e';

https.get(url, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  if (res.statusCode === 302) {
    const redirectUrl = res.headers.location;
    console.log('Redirecting to:', redirectUrl);
    https.get(redirectUrl, (res2) => {
      let data = '';
      res2.on('data', (chunk) => data += chunk);
      res2.on('end', () => {
        console.log('Response body after redirect:');
        console.log(data);
      });
    });
  } else {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Response body:');
      console.log(data);
    });
  }
}).on('error', (err) => {
  console.error('Error:', err.message);
});
