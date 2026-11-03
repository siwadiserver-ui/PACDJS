const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// 📂 Folder ng Backups
function getBackupDirectory() {
  const candidateDirs = [
    'C:\\PACDJS\\backups',
    path.join(process.cwd(), 'backups'),
    path.join(__dirname, '../../backups')
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) return dir;
  }

  const defaultDir = 'C:\\PACDJS\\backups';
  fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}

// 🔍 Active Database File
function getActiveDatabasePath() {
  const candidatePaths = [
    'C:\\PACDJS\\PACD_WATER.FDB',
    'C:\\PACDJS\\database\\PACD_WATER.FDB',
    path.join(process.cwd(), 'PACD_WATER.FDB'),
    path.join(process.cwd(), 'database', 'PACD_WATER.FDB')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }

  return 'C:\\PACDJS\\PACD_WATER.FDB';
}

// 📋 1. List Backups
router.get('/list', (req, res) => {
  try {
    const backupDir = getBackupDirectory();
    if (!fs.existsSync(backupDir)) {
      return res.json({ success: true, data: [] });
    }

    const files = fs.readdirSync(backupDir);
    const backups = files
      .filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ext === '.fdb' || ext === '.fbk' || ext === '.bak';
      })
      .map(filename => {
        const fullPath = path.join(backupDir, filename);
        const stats = fs.statSync(fullPath);
        return {
          filename,
          size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: backups });
  } catch (err) {
    console.error('List backup error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 💾 2. Create Backup
router.post('/create', async (req, res) => {
  try {
    const dbPath = getActiveDatabasePath();
    const backupDir = getBackupDirectory();

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({
        success: false,
        message: `Hindi nahanap ang database file sa: ${dbPath}`
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `PACD_WATER_BACKUP_${timestamp}.FDB`;
    const destPath = path.join(backupDir, backupFileName);

    fs.copyFileSync(dbPath, destPath);

    res.json({
      success: true,
      message: `Matagumpay na nagawa ang backup: ${backupFileName}`
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, message: 'Failed to create backup: ' + err.message });
  }
});

// 📥 3. Download Backup
router.get('/download/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const backupDir = getBackupDirectory();
  const filePath = path.join(backupDir, safeFilename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ success: false, message: 'File not found.' });
  }
});

// 🔄 4. Restore Database (Staged-Swap Pattern)
router.post('/restore', async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ success: false, message: 'Pangalan ng backup file ang kailangan.' });
  }

  const safeFilename = path.basename(filename);
  const backupDir = getBackupDirectory();
  const backupPath = path.join(backupDir, safeFilename);

  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ success: false, message: 'Hindi umiiral ang backup file sa disk.' });
  }

  const pendingSwapPath = path.join(backupDir, 'PENDING_RESTORE.FDB');

  try {
    if (fs.existsSync(pendingSwapPath)) {
      try { fs.unlinkSync(pendingSwapPath); } catch (e) {}
    }
    fs.copyFileSync(backupPath, pendingSwapPath);

    res.json({
      success: true,
      restarting: true,
      message: `✅ Na-stage ang backup (${safeFilename})! Awtomatikong magre-restart ang server upang maisagawa ang database restore.`
    });

    setTimeout(() => {
      console.log('🔄 Restarting Node.js service to apply database restore...');
      process.exit(0);
    }, 3000);

  } catch (err) {
    console.error('❌ Restore Staging Error:', err);
    res.status(500).json({
      success: false,
      message: `Error sa pag-stage ng restore: ${err.message}`
    });
  }
});

// 🗑️ 5. Delete Backup
router.delete('/delete/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const backupDir = getBackupDirectory();
  const filePath = path.join(backupDir, safeFilename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Backup file deleted.' });
    } else {
      res.status(404).json({ success: false, message: 'File not found.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;