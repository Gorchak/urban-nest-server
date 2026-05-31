const salesService = require('../services/salesService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getSales = asyncHandler(async (req, res) => {
  const result = await salesService.getSalesList(req.query);
  res.status(200).json(ApiResponse.success(result.data, 'Sales retrieved successfully', result.pagination));
});

const getSaleById = asyncHandler(async (req, res) => {
  const item = await salesService.getSaleById(req.params.id);
  res.status(200).json(ApiResponse.success(item, 'Sale retrieved successfully'));
});

const createSale = asyncHandler(async (req, res) => {
  const item = await salesService.createSale(req.body);
  res.status(201).json(ApiResponse.success(item, 'Sale created successfully'));
});

const updateSale = asyncHandler(async (req, res) => {
  const item = await salesService.updateSale(req.params.id, req.body);
  res.status(200).json(ApiResponse.success(item, 'Sale updated successfully'));
});

const deleteSale = asyncHandler(async (req, res) => {
  await salesService.deleteSale(req.params.id);
  res.status(200).json(ApiResponse.success(null, 'Sale deleted successfully'));
});

module.exports = {
  getSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
};
