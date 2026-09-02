const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const newsletterService = require('../services/newsletterService');

const subscribe = asyncHandler(async (req, res) => {
  const result = await newsletterService.subscribe(req.body?.email);
  const messages = { INVALID_EMAIL: 'Введіть коректну email-адресу.', ALREADY_SUBSCRIBED: 'Ця email-адреса вже підписана на оновлення.', SUBSCRIBED: 'Дякуємо! Ви успішно підписалися на оновлення.' };
  res.status(result.status).json(result.status < 400 ? ApiResponse.success({ code: result.code }, messages[result.code]) : { success: false, code: result.code, message: messages[result.code] });
});
const unsubscribe = asyncHandler(async (req, res) => {
  const success = await newsletterService.unsubscribe(req.query.token);
  res.status(success ? 200 : 400).json(success ? ApiResponse.success(null, 'Ви успішно відписалися від оновлень.') : { success: false, message: 'Посилання для відписки недійсне або вже використане.' });
});
const preview = asyncHandler(async (req, res) => res.json(ApiResponse.success(await newsletterService.preview())));
const send = asyncHandler(async (req, res) => res.json(ApiResponse.success(await newsletterService.sendNewProductsNewsletter())));
const getUserPreference = asyncHandler(async (req, res) => {
  const userService = require('../services/userService');
  const user = await userService.getById(req.params.id);
  const result = await newsletterService.getSubscriptionStatus(user.email);
  res.json(ApiResponse.success(result));
});
const setUserPreference = asyncHandler(async (req, res) => {
  const userService = require('../services/userService');
  const user = await userService.getById(req.params.id);
  const result = await newsletterService.setSubscriptionPreference(user.email, req.body?.enabled === true);
  res.json(ApiResponse.success(result, result.isSubscribed ? 'Підписку на новинки увімкнено.' : 'Підписку на новинки вимкнено.'));
});
const getSubscribers = asyncHandler(async (req, res) => {
  const result = await newsletterService.getSubscribers(req.query);
  res.json(ApiResponse.success(result.data, 'Підписників отримано.', result.pagination));
});
const deleteSubscriber = asyncHandler(async (req, res) => {
  await newsletterService.deleteSubscriber(req.params.id);
  res.json(ApiResponse.success(null, 'Підписника видалено.'));
});
const retryCampaign = asyncHandler(async (req, res) => res.json(ApiResponse.success(await newsletterService.retryCampaign(req.params.id))));
module.exports = { subscribe, unsubscribe, preview, send, getUserPreference, setUserPreference, getSubscribers, deleteSubscriber, retryCampaign };
