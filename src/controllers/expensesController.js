const expensesService = require('../services/expensesService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getExpenses = asyncHandler(async (req, res) => {
  const result = await expensesService.getExpensesList(req.query);
  res.status(200).json(ApiResponse.success(result.data, 'Expenses retrieved successfully', result.pagination));
});

const createExpense = asyncHandler(async (req, res) => {
  const expense = await expensesService.createExpense(req.body);
  res.status(201).json(ApiResponse.success(expense, 'Expense created successfully'));
});

const updateExpense = asyncHandler(async (req, res) => {
  const expense = await expensesService.updateExpense(req.params.id, req.body);
  res.status(200).json(ApiResponse.success(expense, 'Expense updated successfully'));
});

const deleteExpense = asyncHandler(async (req, res) => {
  await expensesService.deleteExpense(req.params.id);
  res.status(200).json(ApiResponse.success(null, 'Expense deleted successfully'));
});

const applyRecurringExpenses = asyncHandler(async (req, res) => {
  const result = await expensesService.applyRecurringExpenses();
  res.status(200).json(ApiResponse.success(result, 'Recurring expenses applied successfully'));
});

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  applyRecurringExpenses,
};
