const userService = require('../services/userService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, sort, select } = req.query;
  const result = await userService.getAll({}, { page, limit, sort, select });
  res.status(200).json(ApiResponse.success(result.data, 'Users retrieved successfully', result.pagination));
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id);
  res.status(200).json(ApiResponse.success(user, 'User retrieved successfully'));
});

const createUser = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  res.status(201).json(ApiResponse.success(user, 'User created successfully'));
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  res.status(200).json(ApiResponse.success(user, 'User updated successfully'));
});

const deleteUser = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id);
  res.status(200).json(ApiResponse.success(null, 'User deleted successfully'));
});

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser };
