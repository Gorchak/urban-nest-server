const userService = require('../services/userService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, sort, search } = req.query;
  const result = await userService.getAll({ search }, { page, limit, sort });
  res.status(200).json(ApiResponse.success(result.data, 'Users retrieved successfully', result.pagination));
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id);
  res.status(200).json(ApiResponse.success(user, 'User retrieved successfully'));
});

const updateUser = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (!req.canManageUsers) delete updates.appMetadata;
  const user = await userService.update(req.params.id, updates);
  res.status(200).json(ApiResponse.success(user, 'User updated successfully'));
});

const createUser = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (!req.canManageUsers) delete payload.appMetadata;
  const user = await userService.create(payload);
  res.status(201).json(ApiResponse.success(user, 'User created successfully'));
});

const updateUserPassword = asyncHandler(async (req, res) => {
  const user = await userService.updatePassword(req.params.id, req.body.password);
  res.status(200).json(ApiResponse.success(user, 'User password updated successfully'));
});

const sendPasswordReset = asyncHandler(async (req, res) => {
  const result = await userService.sendPasswordReset(req.params.id);
  res.status(200).json(ApiResponse.success(result, 'Password reset email sent successfully'));
});

module.exports = { getUsers, getUserById, createUser, updateUser, updateUserPassword, sendPasswordReset };
