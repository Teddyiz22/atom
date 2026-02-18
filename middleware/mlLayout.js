// ML Layout Middleware
const mlLayout = (req, res, next) => {
  res.locals.layout = 'layouts/ml-layout';
  next();
};

module.exports = mlLayout; 