// ========================================================
// 🔄 PRE-STARTUP DATABASE SWAP CHECK (Ligtas sa EBUSY Lock)
// ========================================================
const fs = require('fs');
const path = require('path'); // 👈 Dito na lang ito idedeklara

const backupDirectory = path.join(__dirname, 'backups');
const pendingSwapFile = path.join(backupDirectory, 'PENDING_RESTORE.FDB');
const activeDatabaseFile = path.join(__dirname, 'PACD_WATER.FDB');

if (fs.existsSync(pendingSwapFile)) {
  try {
    console.log('🔄 May nakitang PENDING_RESTORE.FDB! Isinasagawa ang database swap...');

    // 1. Gumawa muna ng snapshot ng kasalukuyang DB bago palitan
    const safetyBackup = path.join(backupDirectory, `SAFETY_SNAPSHOT_${Date.now()}.FDB`);
    if (fs.existsSync(activeDatabaseFile)) {
      fs.copyFileSync(activeDatabaseFile, safetyBackup);
    }

    // 2. Isagawa ang swap habang sarado pa ang lahat ng connection
    fs.copyFileSync(pendingSwapFile, activeDatabaseFile);
    fs.unlinkSync(pendingSwapFile);
    console.log('✅ Matagumpay na na-restore ang PACD_WATER.FDB!');
  } catch (swapErr) {
    console.error('❌ Nabigo ang pre-startup database swap:', swapErr);
  }
}
// ========================================================

const express = require('express');
// INALIS DITO ANG: const path = require('path'); (Dahil declared na sa taas)
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = 3001;

// 💬 Socket.io Realtime Broadcast Handler
io.on('connection', (socket) => {
  // Makinig kapag may nagpadala ng mensahe
  socket.on('send_global_chat', (data) => {
    // I-broadcast ang mensahe sa LAHAT ng nakakonektang users
    io.emit('receive_global_chat', data);
  });
});

// Middlewares
app.use(cors());
// IPALIT ITO (Itakda sa 50MB):
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// 📌 Controllers / Routes
const authRoutes = require('./modules/auth/auth.routes');
const serviceRequestRoutes = require('./modules/commercial/service-request.routes');
const excelRoutes = require('./modules/commercial/excel-upload.routes');
const requestDetailsRoutes = require('./modules/misc/request-details.routes');
const usersRoutes = require('./modules/misc/users.routes');
const coordinatesRoutes = require('./modules/misc/coordinates.routes');
const disconnectionRoutes = require('./modules/commercial/disconnection');

// Engineering Print Accomplishment Route
const engrPrintService = require('./modules/engineering/engr_printservice');

const billingSyncRoutes = require('./modules/admin/billing-sync.routes')(io);

const scheduleRoutes = require('./modules/others/schedule.routes');


// 📂 OTHERS MODULES
app.use('/api/raffle', require('./modules/others/raffle-winners'));
app.use('/api/bill-calculator', require('./modules/others/bill-calculator'));

// 🛠️ ADMIN & MISC ROUTES
app.use('/api/backup-restore', require('./modules/misc/backup-restore'));

// 📌 API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/commercial/service-requests', serviceRequestRoutes);
app.use('/api/commercial/excel', excelRoutes);
app.use('/api/misc/request-details', requestDetailsRoutes);
app.use('/api/misc/users', usersRoutes);
app.use('/api/misc/coordinates', coordinatesRoutes);
app.use('/api/commercial/reconnections', require('./modules/commercial/reconnection.routes'));
app.use('/api/disconnection', disconnectionRoutes);
app.use('/api/application', require('./modules/commercial/application'));
app.use('/api/nsc', require('./modules/commercial/new-service-connection'));
app.use('/api/transfer', require('./modules/commercial/transfer'));
app.use('/api/plumbers', require('./modules/misc/plumbers'));
app.use('/api/request-actions', require('./modules/misc/request-actions.routes'));
app.use('/api/materials', require('./modules/misc/materials.routes'));
app.use('/api/engr/service-requests', require('./modules/engineering/service-request-engr'));
app.use('/api/engr/reconnections', require('./modules/engineering/reconnection-engr'));
app.use('/api/engr/new-connections', require('./modules/engineering/new-connection-engr')); 
app.use('/api/engr/accomplishments', require('./modules/engineering/accomplishments-engr')); 
app.use('/api/analytics', require('./modules/misc/dashboard-analytics'));
app.use('/api/requirements', require('./modules/misc/requirements.routes'));
app.use('/api/engr', engrPrintService);

app.use('/api/gad', require('./modules/commercial/gad'));
app.use('/api/commercial/senior', require('./modules/commercial/senior'));

app.use('/api/notifications', require('./modules/notifications'));

app.use('/api', billingSyncRoutes);

app.use('/api/schedule', scheduleRoutes);

// Fallback sa index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ignore favicon 404 (para malinis ang console log)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// 👈 5. Pinalitan ang app.listen ng server.listen
server.listen(PORT, () => {
  console.log(`🚀 PACD Portal running on http://localhost:${PORT}`);
});

// Database Warm-up sa pag-start ng server
const db = require('./config/db');

async function warmUpDatabase() {
  try {
    await db.query('SELECT 1 FROM RDB$DATABASE');
    console.log('⚡ Database connected and ready.');
  } catch (err) {
    console.warn('⚠️ Database connection warning:', err.message);
  }
}

// Tawagin sa pag-start
warmUpDatabase();