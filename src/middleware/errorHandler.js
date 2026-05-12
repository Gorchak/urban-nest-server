const ApiError = require('./ApiError');
const { ApiResponse } = require('../utils/apiResponse');

const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error] ${err.stack}`);
  }

  if (err.name === 'CastError') {
    error = new ApiError(`Resource not found with id of ${err.value}`, 404);
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message);
    error = new ApiError(message.join(', '), 400);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new ApiError(`Duplicate value for field: ${field}`, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    error = new ApiError('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError('Token expired', 401);
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(
      ApiResponse.error(err.message, err.statusCode)
    );
  }

  res.status(error.statusCode || 500).json(
    ApiResponse.error(error.message || 'Internal Server Error', error.statusCode || 500)
  );
};

module.exports = { globalErrorHandler };
