const favoritesService = require('../services/favoritesService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getFavorites = asyncHandler(async (req, res) => {
  const items = await favoritesService.getByUser(req.auth.sub);
  res.json(ApiResponse.success(items, 'Favorites retrieved successfully'));
});

const addFavorite = asyncHandler(async (req, res) => {
  const item = await favoritesService.add(req.auth.sub, req.body, req.auth || {});
  res.status(201).json(ApiResponse.success(item, 'Favorite added successfully'));
});

const removeFavorite = asyncHandler(async (req, res) => {
  await favoritesService.remove(req.auth.sub, req.params.merchandiseId);
  res.json(ApiResponse.success(null, 'Favorite removed successfully'));
});

module.exports = { getFavorites, addFavorite, removeFavorite };
