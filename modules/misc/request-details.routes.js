const express = require('express');
const router = express.Router();
const controller = require('./request-details.controller');

router.get('/active', controller.getActiveList);
router.get('/all', controller.getAllList);
router.post('/add', controller.createDetail);
router.put('/update', controller.updateDetail);
router.delete('/delete/:id', controller.deleteDetail);

module.exports = router;