const express = require('express');
const router = express.Router();
const multer = require('multer');
const controller = require('./excel-upload.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/status', controller.getStatus);
router.post('/upload', upload.single('excelFile'), controller.processUpload);
router.get('/search-customer', controller.searchCustomerPattern);
router.post('/clear', controller.clearDatabase);

module.exports = router;