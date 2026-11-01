const AppError = require('../utils/AppError');

function friendlyCastMessage(err) {
  const kind = (err.kind || '').toLowerCase();
  if (kind === 'number') return `${err.path} must be a valid number`;
  if (kind === 'date') return `${err.path} must be a valid date`;
  if (kind === 'objectid') return `${err.path} reference is invalid`;
  return `${err.path} has an invalid value`;
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}`, errors: [] });
}

// Maps known error types to HTTP status codes; never leaks stack traces.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, errors: err.errors });
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.name === 'CastError' ? friendlyCastMessage(e) : e.message,
    }));
    return res.status(400).json({ success: false, message: errors.map((e) => e.message).join('; '), errors });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: friendlyCastMessage(err), errors: [{ field: err.path, message: friendlyCastMessage(err) }] });
  }
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).filter((f) => f !== 'project');
    return res.status(409).json({
      success: false,
      message: `A record with the same ${fields.join(', ') || 'value'} already exists`,
      errors: fields.map((f) => ({ field: f, message: 'Duplicate value' })),
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON', errors: [] });
  }
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred', errors: [] });
}

module.exports = { notFound, errorHandler };
