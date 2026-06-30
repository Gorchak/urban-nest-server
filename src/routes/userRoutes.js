const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protectAuth0 } = require('../middleware/authMiddleware');

const allowAuthenticatedUserManagement = (req, _res, next) => {
  req.canManageUsers = true;
  next();
};

router.get('/', protectAuth0, userController.getUsers);
router.get('/:id', protectAuth0, allowAuthenticatedUserManagement, userController.getUserById);
router.put('/:id', protectAuth0, allowAuthenticatedUserManagement, userController.updateUser);
router.post('/:id/password', protectAuth0, allowAuthenticatedUserManagement, userController.updateUserPassword);
router.post('/:id/password-reset', protectAuth0, allowAuthenticatedUserManagement, userController.sendPasswordReset);

module.exports = router;
