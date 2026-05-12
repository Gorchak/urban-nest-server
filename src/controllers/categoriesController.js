const categoriesService = require('../services/categoriesService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getCategories = asyncHandler(async (req, res) => {
  const { page, limit, sort, select } = req.query;
  const result = await categoriesService.getAll({}, { page, limit, sort, select });
  res.status(200).json(ApiResponse.success(result.data, 'Categories retrieved successfully', result.pagination));
});

const getCategoriesById = asyncHandler(async (req, res) => {
  const item = await categoriesService.getById(req.params.id);
  res.status(200).json(ApiResponse.success(item, 'Category retrieved successfully'));
});

const createCategories = asyncHandler(async (req, res) => {
  const item = await categoriesService.create(req.body);
  res.status(201).json(ApiResponse.success(item, 'Category created successfully'));
});

const updateCategories = asyncHandler(async (req, res) => {
  const item = await categoriesService.update(req.params.id, req.body);
  res.status(200).json(ApiResponse.success(item, 'Category updated successfully'));
});

const deleteCategories = asyncHandler(async (req, res) => {
  await categoriesService.remove(req.params.id);
  res.status(200).json(ApiResponse.success(null, 'Category deleted successfully'));
});

module.exports = { getCategories, getCategoriesById, createCategories, updateCategories, deleteCategories };
