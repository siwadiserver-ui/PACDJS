const express = require('express');
const router = express.Router();
const controller = require('./materials.controller');

router.get('/active', controller.getActiveList);
router.get('/all', controller.getAllList);
router.post('/create', controller.createMaterial);
router.post('/update', controller.updateMaterial);
router.delete('/:id', controller.deleteMaterial);

module.exports = router;