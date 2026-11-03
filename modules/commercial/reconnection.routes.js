const express = require('express');
const router = express.Router();
const controller = require('./reconnection.controller');

router.get('/next-ref', controller.getNextRef);
router.get('/check-ref', controller.checkRefExists);
router.get('/check-duplicate', controller.checkDuplicateAccount);
router.get('/pool', controller.getDataPool);
router.post('/submit', controller.createRequest);
router.put('/update', controller.updateRequest);
router.delete('/delete/:id', controller.deleteRequest);
router.get('/print/:ref', controller.printPDF);

module.exports = router;