const success = (res, data) => {
  return res.json({
    success: true,
    data
  });
};

const failure = (res, message, status = 400) => {
  return res.status(status).json({
    success: false,
    message
  });
};

module.exports = {
  success,
  failure
};