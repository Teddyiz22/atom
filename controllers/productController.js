const Product = require('../models/Product');
const { Op } = require('sequelize');

const productController = {
  // GET /admin/products - List all products with filtering
  index: async (req, res) => {
    try {
      const {
        category,
        status,
        search,
        sort = 'sort_order',
        order = 'ASC',
        page = 1,
        limit = 20
      } = req.query;

      // Build where clause for filtering
      const whereClause = {};

      if (category && category !== 'all') {
        whereClause.category = category;
      }

      if (status && status !== 'all') {
        whereClause.is_active = status === 'active';
      }

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      // Calculate pagination
      const offset = (page - 1) * limit;

      // Get products with pagination
      const { count, rows: rawProducts } = await Product.findAndCountAll({
        where: whereClause,
        order: [[sort, order.toUpperCase()]],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Convert to JSON and add calculated fields
      const products = rawProducts.map(product => {
        const productData = product.toJSON();
        return productData;
      });

      // Calculate pagination info
      const totalPages = Math.ceil(count / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      // Get category counts for filter sidebar
      const categoryStats = await Product.findAll({
        attributes: [
          'category',
          [Product.sequelize.fn('COUNT', '*'), 'count']
        ],
        group: ['category']
      });

      const statusStats = await Product.findAll({
        attributes: [
          'is_active',
          [Product.sequelize.fn('COUNT', '*'), 'count']
        ],
        group: ['is_active']
      });

      res.render('admin/products/index', {
        title: 'Product Management - ML Diamonds Admin',
        user: req.session.user,
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        },
        filters: {
          category: category || 'all',
          status: status || 'all',
          search: search || '',
          sort,
          order
        },
        categoryStats,
        statusStats
      });
    } catch (error) {
      console.error('Product index error:', error);
      res.render('admin/products/index', {
        title: 'Product Management - ML Diamonds Admin',
        user: req.session.user,
        products: [],
        errorToast: 'Failed to load products. Please try again.'
      });
    }
  },

  // GET /admin/products/:id/edit - Show edit product form
  edit: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findByPk(id);

      if (!product) {
        return res.redirect('/admin/products?errorToast=' + encodeURIComponent('Product not found.'));
      }

      res.render('admin/products/edit', {
        title: `Edit ${product.name} - ML Diamonds Admin`,
        user: req.session.user,
        product: product.toJSON()
      });
    } catch (error) {
      console.error('Product edit error:', error);
      res.redirect('/admin/products?errorToast=' + encodeURIComponent('Failed to load product for editing.'));
    }
  },

  // PUT /admin/products/:id - Update product (only allowed fields)
  update: async (req, res) => {
    try {
      console.log('🔄 Update method called');
      console.log('📝 Request method:', req.method);
      console.log('🆔 Product ID:', req.params.id);
      console.log('📦 Request body:', req.body);

      const { id } = req.params;

      // Check if ID is valid
      if (!id || isNaN(id)) {
        console.log('❌ Invalid product ID:', id);
        return res.status(400).redirect('/admin/products?errorToast=' + encodeURIComponent('Invalid product ID.'));
      }

      const {
        price_mmk,
        price_thb,
        is_active,
        is_featured,
        sort_order
      } = req.body;

      console.log('🔍 Looking for product with ID:', id);
      const product = await Product.findByPk(id);

      if (!product) {
        console.log('❌ Product not found with ID:', id);
        return res.status(404).redirect('/admin/products?errorToast=' + encodeURIComponent('Product not found.'));
      }

      console.log('✅ Product found:', product.name);

      // Only allow editing specific fields (not name, diamond_amount, category)
      const updateData = {
        price_mmk: parseFloat(price_mmk),
        price_thb: parseFloat(price_thb),
        is_active: is_active === 'on',
        is_featured: is_featured === 'on',
        sort_order: parseInt(sort_order) || 0
      };

      console.log('💾 Update data:', updateData);
      await product.update(updateData);

      console.log('✅ Product updated:', product.name);
      res.redirect('/admin/products?successToast=' + encodeURIComponent(`Product "${product.name}" updated successfully!`));
    } catch (error) {
      console.error('Product update error:', error);
      res.status(500).redirect('/admin/products?errorToast=' + encodeURIComponent('Failed to update product. Please try again.'));
    }
  },

  // POST /admin/products/:id/update - Update product via API (returns JSON)
  updateAPI: async (req, res) => {
    try {
      console.log('🔄 UpdateAPI method called');
      console.log('📝 Request method:', req.method);
      console.log('🆔 Product ID:', req.params.id);
      console.log('📦 Request body:', req.body);

      const { id } = req.params;

      // Check if ID is valid
      if (!id || isNaN(id)) {
        console.log('❌ Invalid product ID:', id);
        return res.status(400).json({ success: false, message: 'Invalid product ID.' });
      }

      const {
        price_mmk,
        price_thb,
        is_active,
        is_featured,
        sort_order
      } = req.body;

      console.log('🔍 Looking for product with ID:', id);
      const product = await Product.findByPk(id);

      if (!product) {
        console.log('❌ Product not found with ID:', id);
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }

      console.log('✅ Product found:', product.name);

      // Only allow editing specific fields (not name, diamond_amount, category)
      const updateData = {
        price_mmk: parseFloat(price_mmk),
        price_thb: parseFloat(price_thb),
        is_active: is_active === true || is_active === 'true',
        is_featured: is_featured === true || is_featured === 'true',
        sort_order: parseInt(sort_order) || 0
      };

      console.log('💾 Update data:', updateData);
      await product.update(updateData);

      console.log('✅ Product updated:', product.name);
      res.json({
        success: true,
        message: `Product "${product.name}" updated successfully!`,
        product: product.toJSON()
      });
    } catch (error) {
      console.error('Product updateAPI error:', error);
      res.status(500).json({ success: false, message: 'Failed to update product. Please try again.' });
    }
  },

  // POST /admin/products/:id/toggle-status - Toggle active status
  toggleStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findByPk(id);

      if (!product) {
        return res.json({ success: false, message: 'Product not found.' });
      }

      await product.update({ is_active: !product.is_active });

      const status = product.is_active ? 'activated' : 'deactivated';
      console.log(`✅ Product ${status}:`, product.name);

      res.json({
        success: true,
        message: `Product "${product.name}" ${status} successfully!`,
        is_active: product.is_active
      });
    } catch (error) {
      console.error('Product toggle status error:', error);
      res.json({ success: false, message: 'Failed to update product status.' });
    }
  },

  // GET /admin/products/:id - View product details
  show: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findByPk(id);

      if (!product) {
        return res.redirect('/admin/products?errorToast=' + encodeURIComponent('Product not found.'));
      }

      res.render('admin/products/show', {
        title: `${product.name} - Product Details`,
        user: req.session.user,
        product
      });
    } catch (error) {
      console.error('Product show error:', error);
      res.redirect('/admin/products?errorToast=' + encodeURIComponent('Failed to load product details.'));
    }
  },

  // POST /admin/products/bulk-action - Bulk actions
  bulkAction: async (req, res) => {
    try {
      const { action, productIds } = req.body;

      if (!productIds || productIds.length === 0) {
        return res.json({ success: false, message: 'No products selected.' });
      }

      let updateData = {};
      let message = '';

      switch (action) {
        case 'activate':
          updateData = { is_active: true };
          message = `${productIds.length} products activated successfully!`;
          break;
        case 'deactivate':
          updateData = { is_active: false };
          message = `${productIds.length} products deactivated successfully!`;
          break;
        case 'feature':
          updateData = { is_featured: true };
          message = `${productIds.length} products marked as featured!`;
          break;
        case 'unfeature':
          updateData = { is_featured: false };
          message = `${productIds.length} products removed from featured!`;
          break;
        default:
          return res.json({ success: false, message: 'Invalid action.' });
      }

      await Product.update(updateData, {
        where: { id: productIds }
      });

      console.log(`✅ Bulk action ${action} applied to ${productIds.length} products`);
      res.json({ success: true, message });
    } catch (error) {
      console.error('Bulk action error:', error);
      res.json({ success: false, message: 'Failed to perform bulk action.' });
    }
  },

  // GET /admin/products/new - Show new product form
  new: async (req, res) => {
    try {
      res.render('admin/products/new', {
        title: 'Add New Product - ML Diamonds Admin',
        user: req.session.user
      });
    } catch (error) {
      console.error('Product new error:', error);
      res.redirect('/admin/products?errorToast=' + encodeURIComponent('Failed to load new product form.'));
    }
  },

  // POST /admin/products - Create new product
  create: async (req, res) => {
    try {
      const {
        name,
        description,
        category,
        diamond_amount,
        price_mmk,
        price_thb,
        is_active,
        is_featured,
        sort_order
      } = req.body;

      // Validation
      if (!name || !category || !diamond_amount || !price_mmk || !price_thb) {
        return res.redirect('/admin/products/new?errorToast=' + encodeURIComponent('Please fill in all required fields.'));
      }

      const productData = {
        name,
        description: description || '',
        category,
        diamond_amount: parseInt(diamond_amount),
        price_mmk: parseFloat(price_mmk),
        price_thb: parseFloat(price_thb),
        is_active: is_active === 'on',
        is_featured: is_featured === 'on',
        sort_order: parseInt(sort_order) || 0
      };

      const product = await Product.create(productData);
      console.log('✅ Product created:', product.name);

      res.redirect('/admin/products?successToast=' + encodeURIComponent(`Product "${product.name}" created successfully!`));
    } catch (error) {
      console.error('Product create error:', error);
      res.redirect('/admin/products/new?errorToast=' + encodeURIComponent('Failed to create product. Please try again.'));
    }
  },

  // DELETE /admin/products/:id - Delete product
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findByPk(id);

      if (!product) {
        return res.json({ success: false, message: 'Product not found.' });
      }

      const productName = product.name;
      await product.destroy();

      console.log('✅ Product deleted:', productName);
      res.json({
        success: true,
        message: `Product "${productName}" deleted successfully!`
      });
    } catch (error) {
      console.error('Product delete error:', error);
      res.json({ success: false, message: 'Failed to delete product. Please try again.' });
    }
  }
};

module.exports = productController; 
