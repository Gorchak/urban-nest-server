const novaPoshtaService = require('../services/novaPoshtaService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getAreas = asyncHandler(async (req, res) => {
  const items = await novaPoshtaService.getAreas();
  res.status(200).json(ApiResponse.success(items, 'Nova Poshta areas retrieved successfully'));
});

const getCities = asyncHandler(async (req, res) => {
  const items = await novaPoshtaService.getCities(req.query);
  res.status(200).json(ApiResponse.success(items, 'Nova Poshta cities retrieved successfully'));
});

const getWarehouses = asyncHandler(async (req, res) => {
  const items = await novaPoshtaService.getWarehouses(req.query);
  res.status(200).json(ApiResponse.success(items, 'Nova Poshta warehouses retrieved successfully'));
});

module.exports = {
  getAreas,
  getCities,
  getWarehouses,
};
