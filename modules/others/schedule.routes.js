/**
 * 📅 SIWADI PACD - Meter Reading & Disconnection Schedule API Routes
 * File: modules/commercial/schedule.routes.js
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Siguraduhing may 'backups' o 'data' folder sa root ng PACDJS
const dataDir = path.join(__dirname, '..', '..', 'backups');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 📖 1. GET: Kunin ang Schedule ng specific Month/Year
router.get('/get-schedule', async (req, res) => {
    try {
        const month_year = req.query.month_year;
        if (!month_year) {
            return res.status(400).json({ success: false, message: "Kailangan ang month_year parameter!" });
        }

        const filePath = path.join(dataDir, `schedule_${month_year}.json`);

        let scheduleData = {};
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            scheduleData = parsed.schedule_data || {};
        }

        return res.json({
            success: true,
            data: {
                schedule_data: scheduleData
            }
        });
    } catch (err) {
        console.error("Fetch Schedule Error:", err);
        return res.status(500).json({ success: false, message: "Server error habang kinukuha ang schedule." });
    }
});

// 💾 2. POST: I-save ang Schedule sa Server
router.post('/save-schedule', async (req, res) => {
    try {
        const { month_year, schedule_data } = req.body;

        if (!month_year) {
            return res.status(400).json({ success: false, message: "Kailangan ang month_year!" });
        }

        const filePath = path.join(dataDir, `schedule_${month_year}.json`);
        const payloadToSave = {
            month_year,
            schedule_data: schedule_data || {},
            updated_at: new Date().toISOString()
        };

        fs.writeFileSync(filePath, JSON.stringify(payloadToSave, null, 2), 'utf-8');
        console.log(`✅ Matagumpay na na-save ang Reading & Disconnection Schedule (${month_year})!`);

        return res.json({
            success: true,
            message: "Matagumpay na na-save sa Server!"
        });
    } catch (err) {
        console.error("Save Schedule Error:", err);
        return res.status(500).json({ success: false, message: "Server error habang nagse-save ng schedule." });
    }
});

module.exports = router;