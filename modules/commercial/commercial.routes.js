const express = require('express');
const router = express.Router();
const CommercialController = require('./commercial.controller');

router.get('/customers/search', CommercialController.searchCustomer);
router.get('/recent', CommercialController.getRecentActivity);

router.post('/service-request', CommercialController.createServiceRequest);
router.post('/reconnection', CommercialController.createReconnection);
router.post('/transfer', CommercialController.createTransfer);
router.post('/application', CommercialController.createApplication);
router.post('/new-connection', CommercialController.createNewConnection);

module.exports = router;