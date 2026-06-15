const cartsService = require('../services/cartsService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/ApiError');
const owner = (req) => {
  const userId = req.auth?.sub || null;
  const guestId = userId ? null : String(req.query.guestId || req.body.guestId || '');
  if (!userId && !guestId) throw new ApiError('guestId is required', 400);
  return { userId, guestId };
};

const getCart = asyncHandler(async (req, res) => {
  const { userId, guestId } = owner(req);
  const cart = await cartsService.getOrCreate(userId, guestId, req.auth || {});
  res.json(ApiResponse.success(cart, 'Cart retrieved successfully'));
});
const addItem = asyncHandler(async (req, res) => {
  const { userId, guestId } = owner(req);
  const cart = await cartsService.addItem(userId, guestId, req.body, req.auth || {});
  res.status(201).json(ApiResponse.success(cart, 'Item added to cart'));
});
const updateItem = asyncHandler(async (req, res) => {
  const { userId, guestId } = owner(req);
  const cart = await cartsService.updateItem(userId, guestId, decodeURIComponent(req.params.key), req.body);
  res.json(ApiResponse.success(cart, 'Cart item updated'));
});
const removeItem = asyncHandler(async (req, res) => {
  const { userId, guestId } = owner(req);
  const cart = await cartsService.removeItem(userId, guestId, decodeURIComponent(req.params.key));
  res.json(ApiResponse.success(cart, 'Cart item removed'));
});
const clearCart = asyncHandler(async (req, res) => {
  const { userId, guestId } = owner(req);
  const cart = await cartsService.clear(userId, guestId);
  res.json(ApiResponse.success(cart, 'Cart cleared'));
});
const deleteCart = asyncHandler(async (req, res) => {
  const { userId, guestId } = owner(req);
  await cartsService.remove(userId, guestId);
  res.json(ApiResponse.success(null, 'Cart deleted'));
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, deleteCart };
