const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const checkboxService = require('../services/checkboxService');
const salesService = require('../services/salesService');

const getStatus = asyncHandler(async (req, res) => {
  res.json(ApiResponse.success(checkboxService.getStatus(), 'Checkbox integration status'));
});

const getGoods = asyncHandler(async (req, res) => {
  const result = await checkboxService.getGoods(req.query);
  res.json(ApiResponse.success(result.data, 'Checkbox goods retrieved', result.pagination));
});

const getGood = asyncHandler(async (req, res) => {
  const result = await checkboxService.getGood(req.params.goodId);
  res.json(ApiResponse.success(result, 'Checkbox good retrieved'));
});

const updateGood = asyncHandler(async (req, res) => {
  const result = await checkboxService.updateGood(req.params.goodId, req.body);
  res.json(ApiResponse.success(result, 'Checkbox good updated'));
});

const getReceipts = asyncHandler(async (req, res) => {
  const result = await checkboxService.getReceipts(req.query);
  res.json(ApiResponse.success(result.data, 'Checkbox receipts retrieved', result.pagination));
});

const getFinanceTotals = asyncHandler(async (req, res) => {
  const result = await checkboxService.getFinanceTotals(req.query);
  res.json(ApiResponse.success(result.data, 'Checkbox finance totals retrieved', result.pagination));
});

const fiscalizeSale = asyncHandler(async (req, res) => {
  const sale = await salesService.getSaleById(req.params.saleId);
  const existingId = sale.checkboxFiscalization?.receiptId;
  const result = await checkboxService.fiscalizeSale(sale, existingId);
  const fiscalization = {
    status: result.receipt?.status || 'CREATED',
    receiptId: result.id,
    fiscalCode: result.receipt?.fiscal_code || null,
    fiscalizedAt: result.receipt?.fiscal_date || null,
    updatedAt: new Date(),
  };
  await salesService.setCheckboxFiscalization(sale._id, fiscalization);
  res.status(201).json(ApiResponse.success({ ...result.mapped, checkboxFiscalization: fiscalization }, 'Sale sent to Checkbox'));
});

module.exports = { getStatus, getGoods, getGood, updateGood, getReceipts, getFinanceTotals, fiscalizeSale };
