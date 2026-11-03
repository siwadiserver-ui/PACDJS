const express = require('express');
const router = express.Router();
const controller = require('./coordinates.controller');

router.get('/', controller.getCoordinates);
router.post('/save', controller.saveCoordinates);

module.exports = router;