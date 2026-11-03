const express = require('express');
const router = express.Router();
const controller = require('./request-actions.controller');

router.get('/active', controller.getActiveList);
router.get('/all', controller.getAllList);
router.post('/create', controller.createAction);
router.post('/update', controller.updateAction);
router.delete('/:id', controller.deleteAction);

module.exports = router;