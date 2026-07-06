const { ObjectId } = require('mongodb');
const { collections } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const {
  daysInMonth,
  normalizeExpense,
  toMonthKey,
  validateExpense,
} = require('../models/expenseModel');

const isValidId = (id) => ObjectId.isValid(id);

const buildFilter = (query = {}) => {
  const filter = { deletedAt: null };

  if (query.fromDate) {
    filter.expenseDate = filter.expenseDate || {};
    filter.expenseDate.$gte = new Date(query.fromDate);
  }
  if (query.toDate) {
    filter.expenseDate = filter.expenseDate || {};
    filter.expenseDate.$lte = new Date(query.toDate);
  }
  if (query.fromMonthKey || query.toMonthKey) {
    filter.monthKey = {};
    if (query.fromMonthKey) filter.monthKey.$gte = String(query.fromMonthKey);
    if (query.toMonthKey) filter.monthKey.$lte = String(query.toMonthKey);
  }
  if (query.type) {
    filter.type = new RegExp(String(query.type).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  return filter;
};

const serializeExpense = (expense) => ({
  ...expense,
  _id: String(expense._id),
  recurringSourceId: expense.recurringSourceId ? String(expense.recurringSourceId) : null,
});

const getExpensesList = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = buildFilter(query);

  const cursor = collections.EXPENSES
    .find(filter)
    .sort({ expenseDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const [items, total, totals] = await Promise.all([
    cursor.toArray(),
    collections.EXPENSES.countDocuments(filter),
    collections.EXPENSES.aggregate([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]).toArray(),
  ]);

  return {
    data: items.map(serializeExpense),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      totalAmount: totals[0]?.totalAmount || 0,
    },
  };
};

const createExpense = async (data = {}) => {
  const normalized = normalizeExpense(data);
  const errors = validateExpense(normalized);
  if (errors.length) throw new ApiError(errors.join(', '), 400);

  const now = new Date();
  const doc = {
    ...normalized,
    recurringSourceId: normalized.recurringSourceId && isValidId(normalized.recurringSourceId)
      ? new ObjectId(normalized.recurringSourceId)
      : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const result = await collections.EXPENSES.insertOne(doc);
  return serializeExpense({ ...doc, _id: result.insertedId });
};

const updateExpense = async (id, updates = {}) => {
  if (!isValidId(id)) throw new ApiError('Invalid expense ID format', 400);

  const existing = await collections.EXPENSES.findOne({ _id: new ObjectId(id), deletedAt: null });
  if (!existing) throw new ApiError('Expense not found', 404);

  const normalized = normalizeExpense({ ...existing, ...updates });
  const errors = validateExpense(normalized);
  if (errors.length) throw new ApiError(errors.join(', '), 400);

  const result = await collections.EXPENSES.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    {
      $set: {
        ...normalized,
        recurringSourceId: existing.recurringSourceId || null,
        recurringMonthKey: existing.recurringMonthKey || null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Expense not found', 404);
  return serializeExpense(result);
};

const deleteExpense = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid expense ID format', 400);

  const result = await collections.EXPENSES.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Expense not found', 404);
  return serializeExpense(result);
};

const buildRecurringDate = (template, year, month) => {
  if (template.dateMode === 'month') {
    return new Date(year, month - 1, 1, 12, 0, 0, 0);
  }

  const templateDate = template.expenseDate ? new Date(template.expenseDate) : new Date();
  const day = Math.min(templateDate.getDate(), daysInMonth(year, month));
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const applyRecurringExpenses = async (date = new Date()) => {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + 1;
  const targetMonthKey = toMonthKey(targetYear, targetMonth);

  const templates = await collections.EXPENSES.find({
    deletedAt: null,
    isRecurring: true,
    $or: [
      { recurringSourceId: null },
      { recurringSourceId: { $exists: false } },
    ],
  }).toArray();

  const now = new Date();
  const created = [];

  for (const template of templates) {
    if (template.monthKey === targetMonthKey) continue;

    const alreadyCreated = await collections.EXPENSES.findOne({
      deletedAt: null,
      recurringSourceId: template._id,
      recurringMonthKey: targetMonthKey,
    });
    if (alreadyCreated) continue;

    const expenseDate = buildRecurringDate(template, targetYear, targetMonth);
    const doc = {
      type: template.type,
      dateMode: template.dateMode,
      expenseDate,
      month: targetMonth,
      year: targetYear,
      monthKey: targetMonthKey,
      amount: Number(template.amount) || 0,
      isRecurring: true,
      recurringSourceId: template._id,
      recurringMonthKey: targetMonthKey,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const result = await collections.EXPENSES.insertOne(doc);
    created.push(serializeExpense({ ...doc, _id: result.insertedId }));
  }

  return {
    created,
    monthKey: targetMonthKey,
  };
};

module.exports = {
  getExpensesList,
  createExpense,
  updateExpense,
  deleteExpense,
  applyRecurringExpenses,
};
