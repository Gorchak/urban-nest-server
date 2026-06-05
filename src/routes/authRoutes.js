const express = require('express');
const router = express.Router();
const { protectAuth0 } = require('../middleware/authMiddleware');
const userService = require('../services/userService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

router.get('/me', protectAuth0, asyncHandler(async (req, res) => {
  const user = await userService.getById(req.auth.sub);
  res.status(200).json(ApiResponse.success(user, 'Current user retrieved successfully'));
}));

module.exports = router;
