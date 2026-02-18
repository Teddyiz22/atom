// Admin Layout Middleware
const adminLayout = (req, res, next) => {
  console.log('🔧 Setting admin layout for:', req.url);
  const layout = 'layouts/admin-layout';
  res.locals.layout = layout;

  const originalRender = res.render.bind(res);
  res.render = (view, options, fn) => {
    let renderOptions = options;
    let callback = fn;

    if (typeof options === 'function') {
      callback = options;
      renderOptions = {};
    }

    if (!renderOptions) {
      renderOptions = {};
    }

    if (renderOptions.layout === undefined) {
      renderOptions.layout = layout;
    }

    return originalRender(view, renderOptions, callback);
  };
  next();
};

module.exports = adminLayout; 
