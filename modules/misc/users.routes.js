const express = require('express');
const router = express.Router();
const controller = require('./users.controller');

router.get('/active', controller.getActiveReceivers);
router.get('/all', controller.getAllUsers);
router.post('/add', controller.addUser);
router.put('/update', controller.updateUser);
router.put('/change-password', controller.changePassword);
router.delete('/delete/:id', controller.deleteUser);

module.exports = router;