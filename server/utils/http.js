// Consistent API response shape: { success, data } or { success, message, errors }.
function sendOk(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function pick(source, fields) {
  const out = {};
  for (const f of fields) {
    if (source && Object.prototype.hasOwnProperty.call(source, f)) out[f] = source[f];
  }
  return out;
}

module.exports = { sendOk, asyncHandler, pick };
