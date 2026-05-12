class ApiResponse {
  static success(data, message = 'Success', pagination = null) {
    const response = { success: true, message, data };
    if (pagination) response.pagination = pagination;
    return response;
  }

  static error(message = 'Error', statusCode = 500, details = null) {
    const response = { success: false, message };
    if (details) response.details = details;
    return { ...response, statusCode };
  }
}

module.exports = { ApiResponse };
