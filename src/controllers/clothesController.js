const clothesService = require('../services/clothesService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getClothes = asyncHandler(async (req, res) => {
  const { page, limit, sort, select } = req.query;
  const result = await clothesService.getAll({}, { page, limit, sort, select });
  res.status(200).json(ApiResponse.success(result.data, 'Clothes retrieved successfully', result.pagination));
});

const getClothesById = asyncHandler(async (req, res) => {
  const item = await clothesService.getById(req.params.id);
  res.status(200).json(ApiResponse.success(item, 'Clothes item retrieved successfully'));
});

const createClothes = asyncHandler(async (req, res) => {
  const item = await clothesService.create(req.body);
  res.status(201).json(ApiResponse.success(item, 'Clothes item created successfully'));
});

const updateClothes = asyncHandler(async (req, res) => {
  const item = await clothesService.update(req.params.id, req.body);
  res.status(200).json(ApiResponse.success(item, 'Clothes item updated successfully'));
});

const deleteClothes = asyncHandler(async (req, res) => {
  await clothesService.remove(req.params.id);
  res.status(200).json(ApiResponse.success(null, 'Clothes item deleted successfully'));
});

module.exports = { getClothes, getClothesById, createClothes, updateClothes, deleteClothes };
