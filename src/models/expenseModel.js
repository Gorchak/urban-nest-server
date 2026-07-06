const VALID_DATE_MODES = ['exact', 'month'];

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
};

const toMonthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const normalizeExpense = (data = {}) => {
  const dateMode = VALID_DATE_MODES.includes(data.dateMode) ? data.dateMode : 'exact';
  const incomingDate = data.expenseDate ? new Date(data.expenseDate) : new Date();
  const baseDate = Number.isNaN(incomingDate.getTime()) ? new Date() : incomingDate;
  const year = Math.max(1970, Number(data.year) || baseDate.getFullYear());
  const month = Math.min(12, Math.max(1, Number(data.month) || baseDate.getMonth() + 1));
  const day = dateMode === 'month'
    ? 1
    : Math.min(baseDate.getDate(), daysInMonth(year, month));
  const expenseDate = new Date(year, month - 1, day, 12, 0, 0, 0);

  return {
    type: String(data.type || '').trim(),
    dateMode,
    expenseDate,
    month,
    year,
    monthKey: toMonthKey(year, month),
    amount: toNumber(data.amount),
    isRecurring: Boolean(data.isRecurring),
    recurringSourceId: data.recurringSourceId || null,
    recurringMonthKey: data.recurringMonthKey || null,
  };
};

const validateExpense = (data = {}) => {
  const errors = [];

  if (!data.type) errors.push('type is required');
  if (!VALID_DATE_MODES.includes(data.dateMode)) {
    errors.push(`dateMode must be one of: ${VALID_DATE_MODES.join(', ')}`);
  }
  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
    errors.push('amount must be greater than 0');
  }
  if (!Number.isInteger(Number(data.month)) || Number(data.month) < 1 || Number(data.month) > 12) {
    errors.push('month must be between 1 and 12');
  }
  if (!Number.isInteger(Number(data.year)) || Number(data.year) < 1970) {
    errors.push('year must be 1970 or later');
  }
  if (!(data.expenseDate instanceof Date) || Number.isNaN(data.expenseDate.getTime())) {
    errors.push('expenseDate must be a valid date');
  }

  return errors;
};

module.exports = {
  VALID_DATE_MODES,
  normalizeExpense,
  validateExpense,
  toMonthKey,
  daysInMonth,
};
