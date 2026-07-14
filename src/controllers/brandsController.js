const service = require('../services/brandsService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getAll = asyncHandler(async (req, res) => {
  const result = await service.getAll(req.query);
  res.json(ApiResponse.success(result.data, 'Brands retrieved successfully', result.pagination));
});
const getById = asyncHandler(async (req, res) => res.json(ApiResponse.success(await service.getById(req.params.id), 'Brand retrieved successfully')));
const getBySlug = asyncHandler(async (req, res) => res.json(ApiResponse.success(await service.getBySlug(req.params.slug), 'Brand retrieved successfully')));
const create = asyncHandler(async (req, res) => res.status(201).json(ApiResponse.success(await service.create(req.body), 'Brand created successfully')));
const update = asyncHandler(async (req, res) => res.json(ApiResponse.success(await service.update(req.params.id, req.body), 'Brand updated successfully')));
const remove = asyncHandler(async (req, res) => { await service.remove(req.params.id); res.json(ApiResponse.success(null, 'Brand deleted successfully')); });

module.exports = { getAll, getById, getBySlug, create, update, remove };
