const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'SIWADI PACD Portal Server',
  script: path.join(__dirname, 'server.js')
});

svc.on('uninstall', function(){
  console.log('🛑 Matagumpay na natanggal ang SIWADI PACD Portal Windows Service.');
});

svc.uninstall();