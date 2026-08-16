/**
 * Send a success response.
 * @param {object} res - Express response
 * @param {object} data - Response payload
 * @param {string} [message] - Optional message
 * @param {number} [statusCode=200] - HTTP status code
 */
const success = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send an error response.
 * @param {object} res - Express response
 * @param {string} message - Error message
 * @param {number} [statusCode=500] - HTTP status code
 * @param {object} [errors] - Validation errors or details
 */
const error = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
  };
  if (errors) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
};

module.exports = { success, error };
