const Service = require('node-windows').Service;
const path = require('path');

// 🏢 Windows Service Instance para sa PACD Portal
const svc = new Service({
  name: 'SIWADI PACD Portal Server',
  description: 'Siniloan Water District - Public Assistance and Complaints Desk Portal Background Server',
  script: path.join(__dirname, 'server.js'),
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    },
    {
      name: "PORT",
      value: "3001" // Tinitiyak na port 3001 ang gagamitin ng service
    }
  ]
});

// Awtomatikong i-start pagkatapos ma-install
svc.on('install', function(){
  svc.start();
  console.log('🎉 Matagumpay na na-install at tumatakbo na sa background ang SIWADI PACD Portal sa Port 3001!');
});

svc.install();