const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.post('/:id/password', userController.updateUserPassword);
router.post('/:id/password-reset', userController.sendPasswordReset);

module.exports = router;
