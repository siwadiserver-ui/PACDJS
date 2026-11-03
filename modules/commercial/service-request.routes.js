const express = require('express');
const router = express.Router();
const controller = require('./service-request.controller');

router.get('/next-ref', controller.getNextRef);
router.get('/check-ref', controller.checkRefExists);
router.get('/search-customer', controller.searchCustomerPattern);
router.get('/check-today', controller.checkExistingToday);
router.post('/submit', controller.createRequest);
router.get('/pool', controller.getDataPool);
router.put('/update', controller.updateRequest);
router.delete('/delete/:id', controller.deleteRequest);
router.get('/print/:ref', controller.printRequestPDF);

router.get('/print/:ref', controller.printRequestPDF);

module.exports = router;