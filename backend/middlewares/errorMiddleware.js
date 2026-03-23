const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Server error';

  if (process.env.NODE_ENV === 'development') {
    console.error('❌ ERROR:', {
      message: err.message,
      statusCode: err.statusCode,
      stack: err.stack,
    });
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');

    return res.status(400).json({
      status: 'fail',
      message,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Token expired',
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      status: 'fail',
      message: `${field} already exists`,
    });
  }

  res.status(err.statusCode).json({
    status: 'fail',
    message: err.message,
  });
};

module.exports = errorHandler;
