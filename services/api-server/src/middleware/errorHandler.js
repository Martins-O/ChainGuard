// Error handler utilities

const handleError = (res, error, operation) => {
  console.error(`${operation} error:`, error);
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      error: `${field || 'Record'} already exists`
    });
  }
  
  if (error.name === 'MongoServerError') {
    return res.status(500).json({
      success: false,
      error: 'Database operation failed'
    });
  }
  
  // Default error
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message
  });
};

module.exports = { handleError };
