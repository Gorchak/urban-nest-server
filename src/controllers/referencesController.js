const referencesService = require('../services/referencesService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getReferences = asyncHandler(async (req, res) => {
  const { page, limit, sort, select } = req.query;
  const result = await referencesService.getAll({}, { page, limit, sort, select });
  res.status(200).json(
    ApiResponse.success(result.data, 'References retrieved successfully', result.pagination)
  );
});

const getReferenceById = asyncHandler(async (req, res) => {
  const item = await referencesService.getById(req.params.id);
  res.status(200).json(ApiResponse.success(item, 'Reference retrieved successfully'));
});

const createReference = asyncHandler(async (req, res) => {
  const item = await referencesService.create(req.body);
  res.status(201).json(ApiResponse.success(item, 'Reference created successfully'));
});

const updateReference = asyncHandler(async (req, res) => {
  const item = await referencesService.update(req.params.id, req.body);
  res.status(200).json(ApiResponse.success(item, 'Reference updated successfully'));
});

const deleteReference = asyncHandler(async (req, res) => {
  await referencesService.remove(req.params.id);
  res.status(200).json(ApiResponse.success(null, 'Reference deleted successfully'));
});

module.exports = {
  getReferences,
  getReferenceById,
  createReference,
  updateReference,
  deleteReference,
};
