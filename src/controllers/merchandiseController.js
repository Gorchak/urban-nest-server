const merchandiseService = require('../services/merchandiseService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getMerchandise = asyncHandler(async (req, res) => {
  const result = await merchandiseService.getMerchandiseList(req.query);
  res.status(200).json(
    ApiResponse.success(result.data, 'Merchandise retrieved successfully', result.pagination)
  );
});

const getMerchandiseById = asyncHandler(async (req, res) => {
  const item = await merchandiseService.getMerchandiseById(req.params.id);
  res.status(200).json(ApiResponse.success(item, 'Merchandise retrieved successfully'));
});

const getMerchandiseBySlug = asyncHandler(async (req, res) => {
  const item = await merchandiseService.getMerchandiseBySlug(req.params.slug);
  res.status(200).json(ApiResponse.success(item, 'Merchandise retrieved successfully'));
});

const createMerchandise = asyncHandler(async (req, res) => {
  const item = await merchandiseService.createMerchandise(req.body);
  res.status(201).json(ApiResponse.success(item, 'Merchandise created successfully'));
});

const updateMerchandise = asyncHandler(async (req, res) => {
  const item = await merchandiseService.updateMerchandise(req.params.id, req.body);
  res.status(200).json(ApiResponse.success(item, 'Merchandise updated successfully'));
});

const deleteMerchandise = asyncHandler(async (req, res) => {
  await merchandiseService.deleteMerchandise(req.params.id);
  res.status(200).json(ApiResponse.success(null, 'Merchandise deleted successfully'));
});

module.exports = {
  getMerchandise,
  getMerchandiseById,
  getMerchandiseBySlug,
  createMerchandise,
  updateMerchandise,
  deleteMerchandise,
};
