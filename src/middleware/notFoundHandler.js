const { ApiResponse } = require('../utils/apiResponse');

const notFoundHandler = (req, res) => {
  res.status(404).json(
    ApiResponse.error(`Route ${req.originalUrl} not found`, 404)
  );
};

module.exports = notFoundHandler;
