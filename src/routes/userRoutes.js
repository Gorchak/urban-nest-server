const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protectAuth0, requireAdmin, requireSelfOrAdmin } = require('../middleware/authMiddleware');

router.get('/', protectAuth0, requireAdmin, userController.getUsers);
router.get('/:id', protectAuth0, requireSelfOrAdmin, userController.getUserById);
router.put('/:id', protectAuth0, requireSelfOrAdmin, userController.updateUser);
router.post('/:id/password', protectAuth0, requireSelfOrAdmin, userController.updateUserPassword);
router.post('/:id/password-reset', protectAuth0, requireSelfOrAdmin, userController.sendPasswordReset);

module.exports = router;
