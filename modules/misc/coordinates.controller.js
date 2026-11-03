const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../coordinates.json');

const CoordinatesController = {
  getCoordinates(req, res) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        return res.json({ success: true, data: JSON.parse(content) });
      }
      res.json({ success: true, data: {} });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  saveCoordinates(req, res) {
    try {
      const newCoords = req.body;
      fs.writeFileSync(configPath, JSON.stringify(newCoords, null, 4), 'utf8');
      res.json({ success: true, message: 'Coordinates saved successfully!' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = CoordinatesController;