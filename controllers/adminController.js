const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const axios = require('axios');
const ProductType = require('../models/ProductType');
const PaymentMethod = require('../models/PaymentMethod');
const SmileSubItem = require('../models/SmileSubItem');
const G2BulkItem = require('../models/G2BulkItem');
const GamePurchaseTransaction = require('../models/GamePurchaseTransaction');
const emailService = require('../services/emailService');
const { getMaintenanceStatus, setMaintenanceStatus } = require('../middleware/maintenanceMiddleware');

const MMK_OFFSET_MINUTES = 390;

async function getG2BulkAccountInfo() {
  const rawBaseUrl = String(process.env.G2BULK_API_URL || '').trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const apiKey = String(process.env.G2BULK_API_KEY || '').trim();

  if (!baseUrl || !apiKey) {
    return { ok: false, error: 'G2Bulk API not configured' };
  }

  const url = `${baseUrl}/getMe`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey,
        'x-api-key': apiKey,
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000
    });

    const data = response.data;
    // Adapt to match what the view expects (data.success or direct data)
    // zkl_web returns { ok: !!(data && data.success), data }
    return { ok: true, data: data };
  } catch (error) {
    console.error('G2Bulk Account Info Error:', error.message);
    return { ok: false, error: error.message };
  }
}

function normalizeTypeCode(typeCode) {
  return String(typeCode || '').trim().toLowerCase();
}

function mmkDateStringFromUTC(date = new Date()) {
  const d = new Date(date.getTime() + MMK_OFFSET_MINUTES * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysToDateString(dateStr, daysToAdd) {
  const [y, m, d] = dateStr.split('-').map(n => Number(n));
  const utc = Date.UTC(y, m - 1, d);
  const next = new Date(utc + daysToAdd * 24 * 60 * 60 * 1000);
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

const adminController = {
  // GET /admin - Admin Dashboard
  dashboard: async (req, res) => {
    try {
      console.log('🔄 Loading admin dashboard with real data...');

      // Fetch G2Bulk Account Info
      const g2bulk = await getG2BulkAccountInfo();

      // Get dashboard statistics from database
      const totalUsers = await User.count();
      const activeUsers = await User.count({ where: { status: 'active' } });
      const adminUsers = await User.count({ where: { role: 'admin' } });
      const pendingTransactions = await Transaction.getPendingCount();

      // Purchase stats
      const totalPurchases = await GamePurchaseTransaction.count();
      const completedPurchases = await GamePurchaseTransaction.count({ 
        where: { status: ['completed', 'success', 'partial_success'] } 
      });

      // Calculate total revenue
      const { Sequelize } = require('sequelize');
      const revenueData = await GamePurchaseTransaction.findAll({
        attributes: [
          'currency',
          [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_amount']
        ],
        where: {
          status: ['completed', 'success', 'partial_success']
        },
        group: ['currency']
      });

      let totalRevenueMMK = 0;
      let totalRevenueTHB = 0;

      revenueData.forEach(item => {
        const currency = item.currency?.toLowerCase();
        const amount = parseFloat(item.dataValues.total_amount || 0);
        if (currency === 'mmk') totalRevenueMMK += amount;
        else if (currency === 'thb') totalRevenueTHB += amount;
      });

      const recentUsers = await User.findAll({
        limit: 5,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'name', 'email', 'role', 'status', 'created_at']
      });

      const recentTransactions = await Transaction.findAll({
        limit: 5,
        order: [['created_at', 'DESC']],
        where: { status: 'pending' }
      });

      const recentPurchases = await GamePurchaseTransaction.findAll({
        limit: 5,
        order: [['created_at', 'DESC']],
        include: [{
          model: User,
          attributes: ['name']
        }, {
          model: Product,
          attributes: ['name', 'category']
        }]
      });

      console.log('✅ Dashboard data loaded:', {
        totalUsers,
        activeUsers,
        adminUsers,
        pendingTransactions,
        totalPurchases,
        totalRevenueMMK,
        totalRevenueTHB,
        recentUsersCount: recentUsers.length,
        recentTransactionsCount: recentTransactions.length
      });

      res.render('admin/dashboard', {
        title: 'Admin Dashboard - ATOM Game Shop',
        user: req.session.user,
        g2bulk,
        stats: {
          totalUsers,
          activeUsers,
          adminUsers,
          pendingTransactions,
          totalPurchases,
          completedPurchases,
          totalRevenueMMK,
          totalRevenueTHB,
          recentUsers,
          recentTransactions,
          recentPurchases
        }
      });
    } catch (error) {
      console.error('❌ Admin dashboard error:', error);
      res.render('admin/dashboard', {
        title: 'Admin Dashboard - ATOM Game Shop',
        user: req.session.user,
        error: 'Failed to load dashboard data.',
        stats: {
          totalUsers: 0,
          activeUsers: 0,
          adminUsers: 0,
          pendingTransactions: 0,
          totalPurchases: 0,
          completedPurchases: 0,
          totalRevenueMMK: 0,
          totalRevenueTHB: 0,
          recentUsers: [],
          recentTransactions: [],
          recentPurchases: []
        }
      });
    }
  },

  // GET /admin/users - User Management with server-side processing
  users: async (req, res) => {
    try {
      const users = await User.findAll({
        order: [['created_at', 'DESC']],
        attributes: ['id', 'name', 'email', 'phone_number', 'role', 'status', 'email_verified', 'last_login', 'created_at']
      });

      res.render('admin/users', {
        title: 'User Management - ML Diamonds',
        user: req.session.user,
        users
      });
    } catch (error) {
      console.error('Admin users error:', error);
      res.render('admin/users', {
        title: 'User Management - ML Diamonds',
        user: req.session.user,
        error: 'Failed to load users data.',
        users: []
      });
    }
  },

  // GET /admin/register-user - Admin creates user account
  showRegisterUser: async (req, res) => {
    try {
      res.render('admin/registerUser', {
        title: 'Register New User Account',
        user: req.session.user,
        success: req.query.success === '1',
        error: null,
        form: {}
      });
    } catch (error) {
      console.error('Admin register user page error:', error);
      res.render('admin/registerUser', {
        title: 'Register New User Account',
        user: req.session.user,
        success: false,
        error: 'Failed to load register page.',
        form: {}
      });
    }
  },

  // POST /admin/register-user - Create user directly (auto verified)
  registerUser: async (req, res) => {
    try {
      const fullName = String(req.body.fullName || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      const phoneNumber = String(req.body.phoneNumber || '').trim();
      const password = String(req.body.password || '');
      const confirmPassword = String(req.body.confirmPassword || '');
      const terms = req.body.terms;

      const form = { fullName, email, phoneNumber };

      if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
        return res.status(400).render('admin/registerUser', {
          title: 'Register New User Account',
          user: req.session.user,
          success: false,
          error: 'All fields are required.',
          form
        });
      }

      if (!terms) {
        return res.status(400).render('admin/registerUser', {
          title: 'Register New User Account',
          user: req.session.user,
          success: false,
          error: 'You must confirm terms to create account.',
          form
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).render('admin/registerUser', {
          title: 'Register New User Account',
          user: req.session.user,
          success: false,
          error: 'Passwords do not match.',
          form
        });
      }

      if (password.length < 6) {
        return res.status(400).render('admin/registerUser', {
          title: 'Register New User Account',
          user: req.session.user,
          success: false,
          error: 'Password must be at least 6 characters long.',
          form
        });
      }

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).render('admin/registerUser', {
          title: 'Register New User Account',
          user: req.session.user,
          success: false,
          error: 'An account with this email already exists.',
          form
        });
      }

      const created = await User.create({
        name: fullName,
        email,
        phone_number: phoneNumber,
        password,
        role: 'user',
        status: 'active',
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null
      });

      if (!created) {
        return res.status(500).render('admin/registerUser', {
          title: 'Register New User Account',
          user: req.session.user,
          success: false,
          error: 'Failed to create user account.',
          form
        });
      }

      return res.redirect('/admin/register-user?success=1');
    } catch (error) {
      console.error('Admin register user error:', error);
      return res.status(500).render('admin/registerUser', {
        title: 'Register New User Account',
        user: req.session.user,
        success: false,
        error: error?.message || 'Something went wrong while creating account.',
        form: {
          fullName: String(req.body.fullName || '').trim(),
          email: String(req.body.email || '').trim().toLowerCase(),
          phoneNumber: String(req.body.phoneNumber || '').trim()
        }
      });
    }
  },

  invalidUsers: async (req, res) => {
    try {

      const unverifiedUsersList = await User.findAll({
        where: {
          email_verified: 0
        },
        order: [['created_at', 'DESC']],
        attributes: [
          'id',
          'name',
          'email',
          'phone_number',
          'role',
          'status',
          'email_verified',
          'last_login',
          'created_at'
        ]
      });



      res.render('admin/invalidUsers', {
        title: 'Invalid User Management',
        user: req.session.user,
        totalUnverifiedUser: unverifiedUsersList.length
      })
    } catch (error) {
      console.error('Failed to load invalid users', error);
    }

  },

  verifyUser: async (req, res) => {
    try {
      const { id } = req.params;

      // Find user
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Already verified check
      if (user.email_verified === 1) {
        return res.json({
          success: false,
          error: 'User is already verified'
        });
      }

      // Update user
      await user.update({
        email_verified: 1
      });

      return res.json({
        success: true,
        message: 'User verified successfully'
      });

    } catch (error) {
      console.error('Verify user error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify user'
      });
    }
  },

  approveAllUsers: async (req, res) => {
    try {
      const [updatedCount] = await User.update(
        {
          email_verified: 1,
          status: 'active'
        },
        {
          where: {
            email_verified: 0,
            role: 'user'
          }
        }
      );

      return res.json({
        success: true,
        message: `${updatedCount} users approved successfully`
      });

    } catch (error) {
      console.error('Approve all users error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to approve users'
      });
    }
  },




  // GET /admin/users/unverified/data
  unverifiedUsersData: async (req, res) => {
    try {
      const { Op } = require('sequelize');

      // DataTables parameters
      const draw = parseInt(req.query.draw) || 1;
      const start = parseInt(req.query.start) || 0;
      const length = parseInt(req.query.length) || 10;
      const searchValue = req.query.search?.value || '';
      const orderColumn = parseInt(req.query.order?.[0]?.column) || 0;
      const orderDir = req.query.order?.[0]?.dir || 'desc';

      // Column mapping
      const columns = [
        'id',
        'name',
        'email',
        'phone_number',
        'role',
        'status',
        'email_verified',
        'last_login',
        'created_at'
      ];
      const orderBy = columns[orderColumn] || 'id';

      let whereCondition = {
        email_verified: 0
      };

      // 🔍 Search condition
      if (searchValue) {
        whereCondition = {
          email_verified: 0,
          [Op.or]: [
            { name: { [Op.like]: `%${searchValue}%` } },
            { email: { [Op.like]: `%${searchValue}%` } },
            { phone_number: { [Op.like]: `%${searchValue}%` } },
            { role: { [Op.like]: `%${searchValue}%` } },
            { status: { [Op.like]: `%${searchValue}%` } }
          ]
        };
      }

      // Total unverified users (no search)
      const totalRecords = await User.count({
        where: { email_verified: 0 }
      });

      // Filtered unverified users
      const filteredRecords = await User.count({
        where: whereCondition
      });

      // Fetch paginated data
      const users = await User.findAll({
        where: whereCondition,
        order: [[orderBy, orderDir.toUpperCase()]],
        limit: length,
        offset: start,
        attributes: [
          'id',
          'name',
          'email',
          'phone_number',
          'role',
          'status',
          'email_verified',
          'last_login',
          'created_at'
        ]
      });

      // Format rows
      const data = users.map(user => ([
        user.id,
        user.name,
        user.email,
        user.phone_number || 'N/A',
        `<span class="badge badge-${user.status === 'active' ? 'success' : 'warning'}">${user.status}</span>`,
        `<span class="badge badge-secondary">Unverified</span>`,
        new Date(user.created_at).toLocaleDateString('en-GB'),
        `
    <button class="btn btn-sm btn-success mr-1" onclick="verifyUser(${user.id})">
      <i class="fas fa-check"></i> Verify
    </button>
  `
      ]));


      res.json({
        draw,
        recordsTotal: totalRecords,
        recordsFiltered: filteredRecords,
        data
      });

    } catch (error) {
      console.error('Unverified users data error:', error);
      res.status(500).json({ error: 'Failed to load unverified users data' });
    }
  },


  // GET /admin/users/data - Server-side DataTables endpoint for users
  usersData: async (req, res) => {
    try {
      const { Op } = require('sequelize');

      // DataTables parameters
      const draw = parseInt(req.query.draw) || 1;
      const start = parseInt(req.query.start) || 0;
      const length = parseInt(req.query.length) || 10;
      const searchValue = req.query.search?.value || '';
      const orderColumn = parseInt(req.query.order?.[0]?.column) || 0;
      const orderDir = req.query.order?.[0]?.dir || 'desc';

      // Column mapping for ordering
      const columns = ['id', 'name', 'email', 'phone_number', 'role', 'status', 'email_verified', 'last_login', 'created_at'];
      const orderBy = columns[orderColumn] || 'id';

      // Build search conditions
      let whereCondition = {};
      if (searchValue) {
        whereCondition = {
          [Op.or]: [
            { name: { [Op.like]: `%${searchValue}%` } },
            { email: { [Op.like]: `%${searchValue}%` } },
            { phone_number: { [Op.like]: `%${searchValue}%` } },
            { role: { [Op.like]: `%${searchValue}%` } },
            { status: { [Op.like]: `%${searchValue}%` } }
          ]
        };
      }

      // Get total count (without search)
      const totalRecords = await User.count();

      // Get filtered count (with search)
      const filteredRecords = await User.count({ where: whereCondition });

      // Get paginated and filtered data
      const users = await User.findAll({
        where: whereCondition,
        order: [[orderBy, orderDir.toUpperCase()]],
        limit: length,
        offset: start,
        attributes: ['id', 'name', 'email', 'phone_number', 'role', 'status', 'email_verified', 'last_login', 'created_at']
      });

      // Format data for DataTables
      const data = users.map(user => [
        user.id,
        user.name,
        user.email,
        user.phone_number || 'N/A',
        `<span class="badge badge-${user.role === 'admin' ? 'danger' : 'primary'}">${user.role}</span>`,
        `<span class="badge badge-${user.status === 'active' ? 'success' : 'warning'}" id="status-badge-${user.id}">${user.status}</span>`,
        `<span class="badge badge-${user.email_verified ? 'success' : 'secondary'}">${user.email_verified ? 'Verified' : 'Unverified'}</span>`,
        user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never',
        new Date(user.created_at).toLocaleDateString('en-GB'),
        user.role !== 'admin' ?
          `<button class="btn btn-sm btn-${user.status === 'active' ? 'warning' : 'success'} mr-1" onclick="toggleUserStatus(${user.id})">
            <i class="fas fa-${user.status === 'active' ? 'ban' : 'check'}"></i>
            ${user.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.name}')">
            <i class="fas fa-trash"></i> Delete
          </button>` :
          '<span class="text-muted">Admin User</span>'
      ]);

      res.json({
        draw: draw,
        recordsTotal: totalRecords,
        recordsFiltered: filteredRecords,
        data: data
      });
    } catch (error) {
      console.error('Users data error:', error);
      res.status(500).json({ error: 'Failed to load users data' });
    }
  },

  // POST /admin/users/:id/toggle-status - Toggle User Status
  toggleUserStatus: async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Don't allow disabling admin users
      if (user.role === 'admin') {
        return res.status(403).json({ error: 'Cannot modify admin user status' });
      }

      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await user.update({ status: newStatus });

      res.json({
        success: true,
        message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
        newStatus
      });
    } catch (error) {
      console.error('Toggle user status error:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  },

  // DELETE /admin/users/:id - Delete User
  deleteUser: async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Don't allow deleting admin users
      if (user.role === 'admin') {
        return res.status(403).json({ error: 'Cannot delete admin user' });
      }

      // Don't allow deleting yourself
      if (user.id === req.session.user.id) {
        return res.status(403).json({ error: 'Cannot delete your own account' });
      }

      await user.destroy();

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  },

  // GET /admin/settings - Admin Settings
  settings: async (req, res) => {
    try {
      const maintenanceStatus = await getMaintenanceStatus();

      res.render('admin/settings', {
        title: 'Admin Settings - ATOM Game Shop',
        user: req.session.user,
        maintenanceStatus
      });
    } catch (error) {
      console.error('Settings error:', error);
      res.render('admin/settings', {
        title: 'Admin Settings - ATOM Game Shop',
        user: req.session.user,
        error: 'Failed to load settings',
        maintenanceStatus: false
      });
    }
  },

  productManagement: async (req, res) => {
    return res.render('admin/productManagement/index', {
      title: 'Product Management - ATOM Game Shop',
      user: req.session.user
    });
  },

  productManagementProvider: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      if (!['smile', 'g2bulk'].includes(provider)) {
        return res.redirect('/admin/product-management');
      }

      const productTypeRows = await ProductType.findAll({
        where: { provider },
        order: [['typeCode', 'ASC']]
      });

      let productTypes = productTypeRows.map(pt => pt.toJSON());
      if (provider === 'g2bulk') {
        productTypes = productTypes.filter(pt => normalizeTypeCode(pt.typeCode) !== 'esc');
      }

      res.render('admin/productManagement/provider', {
        title: `Product Management - ${provider} - ATOM Game Shop`,
        user: req.session.user,
        provider,
        productTypes,
        success: req.query.success === '1',
        error: req.query.error ? String(req.query.error) : null
      });
    } catch (error) {
      console.error('Product management provider page error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  productManagementNewProduct: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const typeCode = String(req.params.typeCode || '').trim();
      if (!['smile', 'g2bulk'].includes(provider) || !typeCode) {
        return res.redirect('/admin/product-management');
      }

      if (provider !== 'smile') {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}`);
      }

      const productType = await ProductType.findOne({ where: { provider, typeCode } });
      if (!productType) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('Product type not found.'));
      }

      return res.render('admin/productManagement/newProduct', {
        title: `Add Product - ${provider} - ${productType.name} - ATOM Game Shop`,
        user: req.session.user,
        provider,
        productType,
        form: {},
        error: null
      });
    } catch (error) {
      console.error('Product management new product page error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  productManagementCreateProduct: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const typeCode = String(req.params.typeCode || '').trim();
      if (!['smile', 'g2bulk'].includes(provider) || !typeCode) {
        return res.redirect('/admin/product-management');
      }

      if (provider !== 'smile') {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}`);
      }

      const productType = await ProductType.findOne({ where: { provider, typeCode } });
      if (!productType) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('Product type not found.'));
      }

      const name = String(req.body.name || '').trim();
      const diamondAmountRaw = String(req.body.diamond_amount || '').trim();
      const diamondAmount = provider === 'smile'
        ? Number.parseFloat(diamondAmountRaw)
        : Number.parseInt(diamondAmountRaw, 10);
      const sortOrder = Number.parseInt(String(req.body.sort_order || '0').trim(), 10);
      const status = String(req.body.status || 'active').trim().toLowerCase();

      const region = provider === 'smile' ? String(req.body.region || 'b').trim().toLowerCase() : 'b';
      const smileIDCombinationRaw = provider === 'smile' ? String(req.body.smile_id_combination || '').trim() : '';
      const category = provider === 'smile' ? String(req.body.category || '').trim() : null;

      if (!name) {
        return res.status(400).render('admin/productManagement/newProduct', {
          title: `Add Product - ${provider} - ${productType.name} - ATOM Game Shop`,
          user: req.session.user,
          provider,
          productType,
          form: req.body,
          error: 'Name is required.'
        });
      }

      if (!Number.isFinite(diamondAmount) || Number.isNaN(diamondAmount) || diamondAmount < 0) {
        return res.status(400).render('admin/productManagement/newProduct', {
          title: `Add Product - ${provider} - ${productType.name} - ATOM Game Shop`,
          user: req.session.user,
          provider,
          productType,
          form: req.body,
          error: provider === 'smile'
            ? 'Amount must be a valid non-negative number.'
            : 'Amount must be a valid non-negative integer.'
        });
      }

      if (provider === 'smile' && !['b', 'ph'].includes(region)) {
        return res.status(400).render('admin/productManagement/newProduct', {
          title: `Add Product - ${provider} - ${productType.name} - ATOM Game Shop`,
          user: req.session.user,
          provider,
          productType,
          form: req.body,
          error: 'Region must be valid.'
        });
      }

      const priceMmk = Number(req.body.price_mmk || 0);
      const priceThb = Number(req.body.price_thb || 0);

      // Exchange rate logic skipped for smile provider - using fixed prices from form
      /*
      const { Op } = require('sequelize');
      const todayDate = mmkDateStringFromUTC(new Date());
      const yesterdayDate = addDaysToDateString(todayDate, -1);
      const todayRate = await ExchangeRate.findOne({ where: { date: todayDate } });
      const yesterdayRate = await ExchangeRate.findOne({ where: { date: yesterdayDate } });
      const activeRate = todayRate || yesterdayRate || await ExchangeRate.findOne({
        where: { date: { [Op.lt]: todayDate } },
        order: [['date', 'DESC']]
      });

      const coinToMmk = region === 'ph'
        ? Number(activeRate?.smile_ph_to_mmk || 0)
        : Number(activeRate?.smile_brl_to_mmk || 0);
      const coinToThb = region === 'ph'
        ? Number(activeRate?.smile_ph_to_thb || 0)
        : Number(activeRate?.smile_brl_to_thb || 0);

      if (!activeRate || !Number.isFinite(coinToMmk) || coinToMmk <= 0) {
        return res.status(400).render('admin/productManagement/newProduct', {
          title: `Add Product - ${provider} - ${productType.name} - ATOM Game Shop`,
          user: req.session.user,
          provider,
          productType,
          form: req.body,
          error: 'Missing active Smile exchange rate.'
        });
      }

      const revenueTypeCode = normalizeTypeCode(typeCode);
      const categoryRow = await CategoryRevenuePercentage.findOne({ where: { provider, typeCode: revenueTypeCode } });
      const categoryRevenuePercent = categoryRow?.revenuePercent === null || typeof categoryRow?.revenuePercent === 'undefined'
        ? null
        : Number(categoryRow.revenuePercent);

      const baseMmk = diamondAmount * coinToMmk;
      let sellMmk = baseMmk;
      if (categoryRevenuePercent !== null && typeof categoryRevenuePercent !== 'undefined' && Number.isFinite(categoryRevenuePercent)) {
        sellMmk = baseMmk * (1 + categoryRevenuePercent / 100);
      }

      let sellThb = 0;
      if (coinToThb > 0 && coinToMmk > 0) {
        sellThb = (sellMmk / coinToMmk) * coinToThb;
      }
      */
      
      const sellMmk = priceMmk;
      const sellThb = priceThb;

      const created = await Product.create({
        productTypeId: productType.id,
        name,
        diamond_amount: diamondAmount,
        price_mmk: sellMmk,
        price_thb: sellThb,
        region,
        category,
        smileIDCombination: provider === 'smile' ? (smileIDCombinationRaw || null) : null,
        is_active: status === 'active',
        is_featured: req.body.is_featured === 'on',
        sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder
      });

      // Revenue override logic removed as ProductRevenue model is missing
      
      return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?success=1`);
    } catch (error) {
      console.error('Product management create product error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  productManagementProductList: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const typeCode = String(req.params.typeCode || '').trim();
      if (!['smile', 'g2bulk'].includes(provider) || !typeCode) {
        return res.redirect('/admin/product-management');
      }

      const typeCodeLower = normalizeTypeCode(typeCode);
      const isG2bulk = provider === 'g2bulk';
      if (isG2bulk && typeCodeLower === 'esc') {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('ESC is disabled.'));
      }

      let productType = await ProductType.findOne({ where: { provider, typeCode: typeCodeLower } });
      if (!productType && typeCodeLower !== typeCode) {
        productType = await ProductType.findOne({ where: { provider, typeCode } });
      }
      if (!productType) {
        if (!isG2bulk) {
          return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('Product type not found.'));
        }
        const [pt] = await ProductType.findOrCreate({
          where: { provider: 'g2bulk', typeCode: typeCodeLower },
          defaults: { name: typeCodeLower, type: 'game', status: 'active' }
        });
        productType = pt;
      }

      let products = [];
      if (isG2bulk) {
        const { Op } = require('sequelize');

        // Fetch existing G2BulkItem mappings to check for fixed prices
        const g2bulkItems = await G2BulkItem.findAll({
          include: [{ model: Product, required: true }]
        });
        const g2bulkItemMap = new Map(g2bulkItems.map(i => [String(i.g2bulkProductId), i]));

        // Hardcoded rates as ExchangeRate model is removed
        const usdToMmk = 5300;
        const usdToThb = 34;
        
        // Dynamic revenue calculation is disabled as models are removed
        const categoryRevenuePercent = null;
        const productRevenueById = new Map();

        const rawBaseUrl = String(process.env.G2BULK_API_URL || '').trim();
        const baseUrl = rawBaseUrl.replace(/\/+$/, '');
        const apiKey = String(process.env.G2BULK_API_KEY || '').trim();
        if (!baseUrl || !apiKey) {
          return res.render('admin/productManagement/productList', {
            title: `Product List - ${provider} - ${productType.name} - ATOM Game Shop`,
            user: req.session.user,
            provider,
            productType,
            products: [],
            success: false,
            error: 'Missing G2BULK API configuration.'
          });
        }

        const client = axios.create({
          baseURL: baseUrl,
          timeout: 15000,
          headers: { 'X-API-Key': apiKey, 'x-api-key': apiKey, 'Authorization': `Bearer ${apiKey}` }
        });

        let apiProducts = [];
        try {
          console.log(`Fetching G2Bulk catalogue for: ${typeCodeLower}`);
          const catalogueRes = await client.get(`/games/${encodeURIComponent(typeCodeLower)}/catalogue`);
          const data = catalogueRes?.data;
          
          if (data && data.status === 200 && Array.isArray(data.products)) {
             apiProducts = data.products;
          } else if (Array.isArray(data)) {
            apiProducts = data;
          } else if (Array.isArray(data?.items)) {
            apiProducts = data.items;
          } else if (Array.isArray(data?.catalogues)) {
            apiProducts = data.catalogues;
          }
          
          console.log(`Fetched ${apiProducts.length} products for ${typeCodeLower}`);
        } catch (error) {
          console.error(`G2Bulk API Error for ${typeCodeLower}:`, error.message);
          return res.render('admin/productManagement/productList', {
            title: `Product List - ${provider} - ${productType.name} - ATOM Game Shop`,
            user: req.session.user,
            provider,
            productType,
            products: [],
            success: false,
            error: `Failed to load products from G2BULK: ${error.message}`
          });
        }

        products = (Array.isArray(apiProducts) ? apiProducts : []).map(p => {
          const id = String(p?.id ?? p?.product_id ?? p?.code ?? '').trim();
          const name = String(p?.name ?? p?.product_name ?? p?.title ?? '').trim();
          const unitPriceUsd = Number((p?.price ?? p?.amount ?? p?.unit_price) || 0);
          const baseMmk = unitPriceUsd * usdToMmk;
          const baseThb = unitPriceUsd * usdToThb;

          let sellMmk = baseMmk;
          let sellThb = 0;
          let isFixedPrice = false;
          let fixedProductId = null;

          const g2Item = g2bulkItemMap.get(String(id));
          if (g2Item && g2Item.Product) {
            sellMmk = Number(g2Item.Product.price_mmk);
            sellThb = Number(g2Item.Product.price_thb);
            isFixedPrice = true;
            fixedProductId = g2Item.Product.id;
          } else {
            // Dynamic pricing fallback
            if (categoryRevenuePercent !== null && typeof categoryRevenuePercent !== 'undefined' && Number.isFinite(categoryRevenuePercent)) {
              sellMmk = baseMmk * (1 + categoryRevenuePercent / 100);
            }
            if (usdToThb > 0) {
              const sellUsd = sellMmk / usdToMmk;
              sellThb = sellUsd * usdToThb;
            }
          }

          return {
            id,
            name: name || id,
            unit_price_usd: unitPriceUsd,
            stock: Number((p?.stock ?? p?.quantity ?? p?.available) || 0),
            category_id: null,
            category_title: null,
            base_price_mmk: baseMmk,
            base_price_thb: baseThb,
            price_mmk: sellMmk,
            price_thb: sellThb,
            is_active: true,
            is_fixed_price: isFixedPrice,
            fixed_product_id: fixedProductId
          };
        });
      } else {
        products = await Product.findAll({
          where: { productTypeId: productType.id },
          order: [['sort_order', 'ASC'], ['diamond_amount', 'ASC'], ['id', 'ASC']]
        });
      }

      return res.render('admin/productManagement/productList', {
        title: `Product List - ${provider} - ${productType.name} - ATOM Game Shop`,
        user: req.session.user,
        provider,
        productType,
        products,
        success: req.query.success === '1',
        error: req.query.error ? String(req.query.error) : null
      });
    } catch (error) {
      console.error('Product management product list error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  productManagementEditProduct: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const typeCode = String(req.params.typeCode || '').trim();
      const id = Number(req.params.id);
      if (!['smile', 'g2bulk'].includes(provider) || !typeCode || Number.isNaN(id)) {
        return res.redirect('/admin/product-management');
      }

      const productType = await ProductType.findOne({ where: { provider, typeCode } });
      if (!productType) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('Product type not found.'));
      }

      const product = await Product.findOne({ where: { id, productTypeId: productType.id } });
      if (!product) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?error=` + encodeURIComponent('Product not found.'));
      }

      return res.render('admin/productManagement/newProduct', {
        title: `Edit Product - ${provider} - ${productType.name} - ATOM Game Shop`,
        user: req.session.user,
        provider,
        productType,
        editingProduct: product,
        form: {
          name: product.name,
          region: product.region,
          diamond_amount: product.diamond_amount,
          price_mmk: product.price_mmk,
          price_thb: product.price_thb,
          smile_id_combination: product.smileIDCombination || '',
          status: product.is_active ? 'active' : 'inactive',
          sort_order: product.sort_order
        },
        error: null
      });
    } catch (error) {
      console.error('Product management edit product page error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  productManagementUpdateProduct: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const typeCode = String(req.params.typeCode || '').trim();
      const id = Number(req.params.id);
      if (!['smile', 'g2bulk'].includes(provider) || !typeCode || Number.isNaN(id)) {
        return res.redirect('/admin/product-management');
      }

      const productType = await ProductType.findOne({ where: { provider, typeCode } });
      if (!productType) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('Product type not found.'));
      }

      const product = await Product.findOne({ where: { id, productTypeId: productType.id } });
      if (!product) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?error=` + encodeURIComponent('Product not found.'));
      }

      const name = String(req.body.name || '').trim();
      const diamondAmountRaw = String(req.body.diamond_amount || '').trim();
      const diamondAmount = provider === 'smile'
        ? Number.parseFloat(diamondAmountRaw)
        : Number.parseInt(diamondAmountRaw, 10);
      const sortOrder = Number.parseInt(String(req.body.sort_order || '0').trim(), 10);
      const status = String(req.body.status || 'active').trim().toLowerCase();
      const region = provider === 'smile' ? String(req.body.region || 'b').trim().toLowerCase() : 'b';
      const smileIDCombinationRaw = provider === 'smile' ? String(req.body.smile_id_combination || '').trim() : '';
      const category = provider === 'smile' ? String(req.body.category || '').trim() : null;

      const renderError = async (message) => {
        return res.status(400).render('admin/productManagement/newProduct', {
          title: `Edit Product - ${provider} - ${productType.name} - ATOM Game Shop`,
          user: req.session.user,
          provider,
          productType,
          editingProduct: product,
          form: req.body,
          error: message
        });
      };

      if (!name) {
        return renderError('Name is required.');
      }

      if (!Number.isFinite(diamondAmount) || Number.isNaN(diamondAmount) || diamondAmount < 0) {
        return renderError(provider === 'smile'
          ? 'Amount must be a valid non-negative number.'
          : 'Amount must be a valid non-negative integer.');
      }

      if (provider === 'smile' && !['b', 'ph'].includes(region)) {
        return renderError('Region must be valid.');
      }

      let nextPriceMmk = Number(req.body.price_mmk || 0);
      let nextPriceThb = Number(req.body.price_thb || 0);

      /*
      if (provider === 'smile') {
        const { Op } = require('sequelize');
        const todayDate = mmkDateStringFromUTC(new Date());
        const yesterdayDate = addDaysToDateString(todayDate, -1);
        const todayRate = await ExchangeRate.findOne({ where: { date: todayDate } });
        const yesterdayRate = await ExchangeRate.findOne({ where: { date: yesterdayDate } });
        const activeRate = todayRate || yesterdayRate || await ExchangeRate.findOne({
          where: { date: { [Op.lt]: todayDate } },
          order: [['date', 'DESC']]
        });

        const coinToMmk = region === 'ph'
          ? Number(activeRate?.smile_ph_to_mmk || 0)
          : Number(activeRate?.smile_brl_to_mmk || 0);
        const coinToThb = region === 'ph'
          ? Number(activeRate?.smile_ph_to_thb || 0)
          : Number(activeRate?.smile_brl_to_thb || 0);

        if (!activeRate || !Number.isFinite(coinToMmk) || coinToMmk <= 0) {
          return renderError('Missing active Smile exchange rate.');
        }

        const revenueTypeCode = normalizeTypeCode(typeCode);
        const categoryRow = await CategoryRevenuePercentage.findOne({ where: { provider, typeCode: revenueTypeCode } });
        const categoryRevenuePercent = categoryRow?.revenuePercent === null || typeof categoryRow?.revenuePercent === 'undefined'
          ? null
          : Number(categoryRow.revenuePercent);

        const overrideRow = await ProductRevenue.findOne({
          where: { provider, typeCode: revenueTypeCode, productId: String(product.id) }
        });
        const revenueOverrideMmk = overrideRow?.revenueAmount === null || typeof overrideRow?.revenueAmount === 'undefined'
          ? null
          : Number(overrideRow.revenueAmount);
        const hasOverride = revenueOverrideMmk !== null && typeof revenueOverrideMmk !== 'undefined' && Number.isFinite(Number(revenueOverrideMmk));

        const baseMmk = diamondAmount * coinToMmk;
        let sellMmk = baseMmk;
        if (hasOverride) {
          sellMmk = baseMmk + Number(revenueOverrideMmk);
        } else if (categoryRevenuePercent !== null && typeof categoryRevenuePercent !== 'undefined' && Number.isFinite(categoryRevenuePercent)) {
          sellMmk = baseMmk * (1 + categoryRevenuePercent / 100);
        }

        nextPriceMmk = sellMmk;
        nextPriceThb = 0;
        if (coinToThb > 0 && coinToMmk > 0) {
          nextPriceThb = (sellMmk / coinToMmk) * coinToThb;
        }
      }
      */

      await product.update({
        name,
        diamond_amount: diamondAmount,
        price_mmk: nextPriceMmk,
        price_thb: nextPriceThb,
        region,
        category,
        smileIDCombination: provider === 'smile' ? (smileIDCombinationRaw || null) : null,
        is_active: status === 'active',
        is_featured: req.body.is_featured === 'on',
        sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder
      });

      return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?success=1`);
    } catch (error) {
      console.error('Product management update product error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  productManagementToggleStatus: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const typeCode = String(req.params.typeCode || '').trim();
      const id = Number(req.params.id);
      if (!['smile', 'g2bulk'].includes(provider) || !typeCode || Number.isNaN(id)) {
        return res.redirect('/admin/product-management');
      }

      const productType = await ProductType.findOne({ where: { provider, typeCode } });
      if (!productType) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('Product type not found.'));
      }

      const product = await Product.findOne({ where: { id, productTypeId: productType.id } });
      if (!product) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?error=` + encodeURIComponent('Product not found.'));
      }

      await product.update({ is_active: !product.is_active });
      return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?success=1`);
    } catch (error) {
      console.error('Product management toggle status error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  productManagementToggleFeatured: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const typeCode = String(req.params.typeCode || '').trim();
      const id = Number(req.params.id);
      if (!['smile', 'g2bulk'].includes(provider) || !typeCode || Number.isNaN(id)) {
        return res.redirect('/admin/product-management');
      }

      const productType = await ProductType.findOne({ where: { provider, typeCode } });
      if (!productType) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('Product type not found.'));
      }

      const product = await Product.findOne({ where: { id, productTypeId: productType.id } });
      if (!product) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?error=` + encodeURIComponent('Product not found.'));
      }

      await product.update({ is_featured: !product.is_featured });
      return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?success=1`);
    } catch (error) {
      console.error('Product management toggle featured error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  productManagementDeleteProduct: async (req, res) => {
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const typeCode = String(req.params.typeCode || '').trim();
      const id = Number(req.params.id);
      if (!['smile', 'g2bulk'].includes(provider) || !typeCode || Number.isNaN(id)) {
        return res.redirect('/admin/product-management');
      }

      const productType = await ProductType.findOne({ where: { provider, typeCode } });
      if (!productType) {
        return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}?error=` + encodeURIComponent('Product type not found.'));
      }

      await Product.destroy({ where: { id, productTypeId: productType.id } });
      return res.redirect(`/admin/product-management/${encodeURIComponent(provider)}/${encodeURIComponent(typeCode)}?success=1`);
    } catch (error) {
      console.error('Product management delete product error:', error);
      return res.redirect('/admin/product-management');
    }
  },

  // Revenue management methods deleted

  // Exchange rates method deleted

  productTypes: async (req, res) => {
    try {
      const productTypes = await ProductType.findAll({
        order: [['provider', 'ASC'], ['typeCode', 'ASC']]
      });

      res.render('admin/productTypes', {
        title: 'Product Types - ATOM Game Shop',
        user: req.session.user,
        productTypes,
        success: req.query.success === '1',
        form: {}
      });
    } catch (error) {
      console.error('Product types page error:', error);
      res.render('admin/productTypes', {
        title: 'Product Types - ATOM Game Shop',
        user: req.session.user,
        productTypes: [],
        error: 'Failed to load product types.',
        form: {}
      });
    }
  },

  upsertProductType: async (req, res) => {
    try {
      const id = req.body.id ? Number(req.body.id) : null;
      const provider = String(req.body.provider || '').trim();
      const typeCode = String(req.body.type_code || '').trim();
      const name = String(req.body.name || '').trim();
      const status = String(req.body.status || 'active').trim();
      const type = 'game';

      if (!provider || !typeCode || !name) {
        return res.status(400).render('admin/productTypes', {
          title: 'Product Types - ATOM Game Shop',
          user: req.session.user,
          productTypes: await ProductType.findAll({ order: [['provider', 'ASC'], ['typeCode', 'ASC']] }),
          error: 'Provider, type code, and name are required.',
          form: req.body
        });
      }

      if (!['smile', 'g2bulk'].includes(provider)) {
        return res.status(400).render('admin/productTypes', {
          title: 'Product Types - ATOM Game Shop',
          user: req.session.user,
          productTypes: await ProductType.findAll({ order: [['provider', 'ASC'], ['typeCode', 'ASC']] }),
          error: 'Provider must be smile or g2bulk.',
          form: req.body
        });
      }

      if (id && !Number.isNaN(id)) {
        const existing = await ProductType.findByPk(id);
        if (!existing) {
          return res.redirect('/admin/product-types');
        }
        await existing.update({ provider, typeCode, name, status, type });
      } else {
        await ProductType.create({ provider, typeCode, name, status, type });
      }

      return res.redirect('/admin/product-types?success=1');
    } catch (error) {
      console.error('Upsert product type error:', error);
      res.status(500).render('admin/productTypes', {
        title: 'Product Types - ATOM Game Shop',
        user: req.session.user,
        productTypes: await ProductType.findAll({ order: [['provider', 'ASC'], ['typeCode', 'ASC']] }),
        error: 'Failed to save product type.',
        form: req.body
      });
    }
  },

  deleteProductType: async (req, res) => {
    try {
      const id = Number(req.body.id);
      if (Number.isNaN(id)) {
        return res.redirect('/admin/product-types');
      }
      await ProductType.destroy({ where: { id } });
      return res.redirect('/admin/product-types?success=1');
    } catch (error) {
      console.error('Delete product type error:', error);
      return res.redirect('/admin/product-types');
    }
  },

  toggleProductTypeStatus: async (req, res) => {
    try {
      const id = Number(req.body.id);
      if (Number.isNaN(id)) {
        return res.redirect('/admin/product-types');
      }
      
      const productType = await ProductType.findByPk(id);
      if (!productType) {
        return res.redirect('/admin/product-types');
      }
      
      const newStatus = productType.status === 'active' ? 'inactive' : 'active';
      await productType.update({ status: newStatus });
      
      return res.redirect('/admin/product-types?success=1');
    } catch (error) {
      console.error('Toggle product type status error:', error);
      return res.redirect('/admin/product-types');
    }
  },

  paymentMethods: async (req, res) => {
    try {
      const paymentMethods = await PaymentMethod.findAll({
        order: [['region', 'ASC'], ['payment_type', 'ASC'], ['account_name', 'ASC']]
      });

      res.render('admin/paymentMethods', {
        title: 'Payment Methods - ATOM Game Shop',
        user: req.session.user,
        paymentMethods,
        success: req.query.success === '1'
      });
    } catch (error) {
      console.error('Payment methods page error:', error);
      res.render('admin/paymentMethods', {
        title: 'Payment Methods - ATOM Game Shop',
        user: req.session.user,
        paymentMethods: [],
        error: 'Failed to load payment methods.'
      });
    }
  },

  upsertPaymentMethod: async (req, res) => {
    try {
      const id = req.body.id ? Number(req.body.id) : null;
      const account_number = String(req.body.account_number || '').trim();
      const account_name = String(req.body.account_name || '').trim();
      const payment_type = String(req.body.payment_type || '').trim();
      const region = String(req.body.region || '').trim();
      const is_active = String(req.body.is_active || 'active').trim();

      if (!account_number || !account_name || !payment_type || !region) {
        return res.status(400).render('admin/paymentMethods', {
          title: 'Payment Methods - ATOM Game Shop',
          user: req.session.user,
          paymentMethods: await PaymentMethod.findAll({ order: [['region', 'ASC'], ['payment_type', 'ASC'], ['account_name', 'ASC']] }),
          error: 'Account number, account name, payment type, and region are required.',
          form: req.body
        });
      }

      if (id && !Number.isNaN(id)) {
        const existing = await PaymentMethod.findByPk(id);
        if (!existing) {
          return res.redirect('/admin/payment-methods');
        }
        await existing.update({ account_number, account_name, payment_type, region, is_active });
      } else {
        await PaymentMethod.create({ account_number, account_name, payment_type, region, is_active });
      }

      return res.redirect('/admin/payment-methods?success=1');
    } catch (error) {
      console.error('Upsert payment method error:', error);
      res.status(500).render('admin/paymentMethods', {
        title: 'Payment Methods - ATOM Game Shop',
        user: req.session.user,
        paymentMethods: await PaymentMethod.findAll({ order: [['region', 'ASC'], ['payment_type', 'ASC'], ['account_name', 'ASC']] }),
        error: 'Failed to save payment method.',
        form: req.body
      });
    }
  },

  deletePaymentMethod: async (req, res) => {
    try {
      const id = Number(req.body.id);
      if (Number.isNaN(id)) {
        return res.redirect('/admin/payment-methods');
      }
      await PaymentMethod.destroy({ where: { id } });
      return res.redirect('/admin/payment-methods?success=1');
    } catch (error) {
      console.error('Delete payment method error:', error);
      return res.redirect('/admin/payment-methods');
    }
  },

  saveG2BulkPrice: async (req, res) => {
    try {
      const g2bulkProductId = String(req.body.g2bulk_product_id || '').trim();
      const fixedProductId = req.body.fixed_product_id ? Number(req.body.fixed_product_id) : null;
      const typeCode = String(req.body.type_code || '').trim();
      const name = String(req.body.name || '').trim();
      const priceMmk = Number(req.body.price_mmk);
      const priceThb = Number(req.body.price_thb);

      if (!g2bulkProductId || !name || Number.isNaN(priceMmk) || Number.isNaN(priceThb)) {
        return res.redirect(`/admin/product-management/g2bulk/${encodeURIComponent(typeCode)}?error=` + encodeURIComponent('Missing required fields.'));
      }

      let product;
      if (fixedProductId && !Number.isNaN(fixedProductId)) {
        // Update existing product
        product = await Product.findByPk(fixedProductId);
        if (product) {
          await product.update({
            name,
            price_mmk: priceMmk,
            price_thb: priceThb
          });
        }
      }

      if (!product) {
        // Create new product
        // We need a productTypeId for G2Bulk products if we want to organize them
        const productType = await ProductType.findOne({ where: { provider: 'g2bulk', typeCode } });
        if (!productType) {
           return res.redirect(`/admin/product-management/g2bulk/${encodeURIComponent(typeCode)}?error=` + encodeURIComponent('Product type not found.'));
        }

        product = await Product.create({
          productTypeId: productType.id,
          name,
          price_mmk: priceMmk,
          price_thb: priceThb,
          diamond_amount: 0, // Placeholder
          provider: 'g2bulk',
          is_active: true
        });
      }

      // Ensure mapping exists
      const [item, created] = await G2BulkItem.findOrCreate({
        where: { g2bulkProductId },
        defaults: {
          productId: product.id,
          status: 'active'
        }
      });

      if (!created && item.productId !== product.id) {
        await item.update({ productId: product.id });
      }

      return res.redirect(`/admin/product-management/g2bulk/${encodeURIComponent(typeCode)}?success=1`);
    } catch (error) {
      console.error('Save G2Bulk price error:', error);
      const typeCode = String(req.body.type_code || '').trim();
      return res.redirect(`/admin/product-management/g2bulk/${encodeURIComponent(typeCode)}?error=` + encodeURIComponent('Failed to save price.'));
    }
  },

  gamePurchaseTransactions: async (req, res) => {
    try {
      res.render('admin/gamePurchaseTransactions', {
        title: 'Game Purchase Transactions - ATOM Game Shop',
        user: req.session.user
      });
    } catch (error) {
      console.error('Game purchase transactions page error:', error);
      res.render('admin/gamePurchaseTransactions', {
        title: 'Game Purchase Transactions - ATOM Game Shop',
        user: req.session.user,
        error: 'Failed to load game purchase transactions.'
      });
    }
  },

  // GET /admin/game-purchase-transactions/data - Server-side DataTables endpoint
  gamePurchaseTransactionsData: async (req, res) => {
    try {
      const { Op } = require('sequelize');

      // DataTables parameters
      const draw = parseInt(req.query.draw) || 1;
      const start = parseInt(req.query.start) || 0;
      const length = parseInt(req.query.length) || 10;
      const searchValue = req.query.search?.value || '';
      const orderColumn = parseInt(req.query.order?.[0]?.column) || 0;
      const orderDir = req.query.order?.[0]?.dir || 'desc';

      // Column mapping for ordering
      // 0: id, 1: user, 2: game_id, 3: server_id, 4: provider, 5: type_code, 6: product, 7: total, 8: status, 9: created_at
      const columns = ['id', 'user_name', 'player_id', 'server_id', 'provider', 'product_type_code', 'product_name', 'total_amount', 'status', 'created_at'];
      const orderBy = columns[orderColumn] || 'created_at';

      // Build search conditions
      let whereCondition = {};
      
      if (searchValue) {
        whereCondition = {
          [Op.or]: [
            { id: { [Op.like]: `%${searchValue}%` } },
            { user_name: { [Op.like]: `%${searchValue}%` } },
            { user_id: { [Op.like]: `%${searchValue}%` } },
            { player_id: { [Op.like]: `%${searchValue}%` } },
            { server_id: { [Op.like]: `%${searchValue}%` } },
            { provider: { [Op.like]: `%${searchValue}%` } },
            { product_type_code: { [Op.like]: `%${searchValue}%` } },
            { product_name: { [Op.like]: `%${searchValue}%` } },
            { status: { [Op.like]: `%${searchValue}%` } },
            // Search by date (optional)
            // { created_at: { [Op.like]: `%${searchValue}%` } } 
          ]
        };
      }

      // Get total count (without search)
      const totalRecords = await GamePurchaseTransaction.count();

      // Get filtered count (with search)
      const filteredRecords = await GamePurchaseTransaction.count({ where: whereCondition });

      // Get paginated and filtered data
      const transactions = await GamePurchaseTransaction.findAll({
        where: whereCondition,
        order: [[orderBy, orderDir.toUpperCase()]],
        limit: length,
        offset: start
      });

      // Format data for DataTables
      const data = transactions.map(t => {
        const isG2BulkPending = t.provider === 'g2bulk' && t.status === 'pending';
        const isG2BulkProcessing = t.provider === 'g2bulk' && t.status === 'processing';
        const isG2BulkCompleted = t.provider === 'g2bulk' && (t.status === 'completed' || t.status === 'success');

        let statusLabel = t.status;
        if (isG2BulkPending) statusLabel = 'success (p)';
        else if (isG2BulkProcessing) statusLabel = 'success (n)';
        else if (isG2BulkCompleted) statusLabel = 'success';

        const isSuccessStyle = isG2BulkPending || isG2BulkProcessing || isG2BulkCompleted || t.status === 'success' || t.status === 'completed';
        const isWarningStyle = !isSuccessStyle && (t.status === 'pending' || t.status === 'processing');
        const badgeClass = isSuccessStyle ? 'success' : (isWarningStyle ? 'warning' : 'danger');

        return [
          t.id,
          `
        <div class="font-weight-bold">${t.user_name || 'Unknown'}</div>
        <div class="text-muted small">#${t.user_id}</div>
        `,
          t.player_id || '-',
          t.server_id || '-',
          t.provider,
          t.product_type_code,
          `
        <div class="font-weight-bold">${t.product_name}</div>
        <div class="text-muted small">${t.product_id}</div>
        `,
          `<div class="text-right">${Number(t.total_amount || 0).toLocaleString()} ${t.currency}</div>`,
          `<span class="badge badge-${badgeClass}">${statusLabel}</span>`,
          t.created_at
            ? new Date(t.created_at).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZone: 'Asia/Yangon'
              })
            : ''
        ];
      });

      res.json({
        draw: draw,
        recordsTotal: totalRecords,
        recordsFiltered: filteredRecords,
        data: data
      });
    } catch (error) {
      console.error('Game purchase transactions data error:', error);
      res.status(500).json({
        error: 'Failed to load data'
      });
    }
  },

  // Remaining revenue management and exchange rate methods deleted

  // GET /admin/maintenance/status - Get maintenance mode status
  getMaintenanceStatus: async (req, res) => {
    try {
      const enabled = await getMaintenanceStatus();
      res.json({
        success: true,
        enabled: enabled
      });
    } catch (error) {
      console.error('Get maintenance status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get maintenance status'
      });
    }
  },

  // POST /admin/maintenance/toggle - Toggle maintenance mode
  toggleMaintenanceMode: async (req, res) => {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Invalid enabled value'
        });
      }

      const success = await setMaintenanceStatus(enabled);

      if (!success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update maintenance mode'
        });
      }

      // Log the action
      console.log(`🔧 Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'} by admin: ${req.session.user.name}`);

      res.json({
        success: true,
        message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`,
        enabled: enabled
      });

    } catch (error) {
      console.error('Toggle maintenance mode error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle maintenance mode'
      });
    }
  },

  // GET /maintenance-preview - Preview maintenance page (for admins)
  maintenancePreview: (req, res) => {
    res.render('maintenance', {
      title: 'Maintenance Preview - ATOM Game Shop',
      layout: false
    });
  },

  // GET /admin/wallets - Wallet Management
  wallets: async (req, res) => {
    try {
      // Get basic stats for the dashboard cards
      const totalUsers = await User.count();

      // Get total balances from wallets directly
      const totalMMK = await Wallet.sum('balance_mmk') || 0;
      const totalTHB = await Wallet.sum('balance_thb') || 0;
      const activeUsers = await User.count({ where: { status: 'active' } });

      const stats = {
        totalUsers,
        totalMMK,
        totalTHB,
        activeUsers
      };

      res.render('admin/wallets', {
        title: 'Wallet Management - ML Diamonds Admin',
        user: req.session.user,
        stats: stats,
        successToast: req.query.successToast,
        errorToast: req.query.errorToast
      });
    } catch (error) {
      console.error('Admin wallets error:', error);
      res.render('admin/wallets', {
        title: 'Wallet Management - ML Diamonds Admin',
        user: req.session.user,
        stats: { totalUsers: 0, totalMMK: 0, totalTHB: 0, activeUsers: 0 },
        errorToast: 'Failed to load wallet data.'
      });
    }
  },

  // POST /admin/wallets/:id/update - Update user wallet balance
  updateWallet: async (req, res) => {
    try {
      const { id } = req.params; // User ID
      const { action, amount, currency, reason } = req.body;

      // Validation
      if (!action || !amount || !currency || !reason) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be a positive number'
        });
      }

      if (!['increase', 'decrease'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
      }

      if (!['MMK', 'THB'].includes(currency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid currency'
        });
      }

      // Find user
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get or create wallet
      let wallet = await Wallet.findByUserId(id);
      if (!wallet) {
        wallet = await Wallet.create({
          userId: id,
          balance_mmk: 0,
          balance_thb: 0
        });
      }

      // Calculate new balance
      const balanceField = currency === 'MMK' ? 'balance_mmk' : 'balance_thb';
      const currentBalance = parseFloat(wallet[balanceField]);
      let newBalance;

      if (action === 'increase') {
        newBalance = currentBalance + amountValue;
      } else { // decrease
        newBalance = Math.max(0, currentBalance - amountValue); // Don't allow negative balance
      }

      // Update wallet
      await wallet.update({ [balanceField]: newBalance });

      // Log the action
      console.log(`💰 Wallet ${action} by admin: ${req.session.user.name}`);
      console.log(`   User: ${user.name} (${user.email})`);
      console.log(`   Amount: ${amountValue.toLocaleString()} ${currency}`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Balance: ${currentBalance.toLocaleString()} → ${newBalance.toLocaleString()} ${currency}`);

      res.json({
        success: true,
        message: `Successfully ${action}d ${amountValue.toLocaleString()} ${currency} ${action === 'increase' ? 'to' : 'from'} ${user.name}'s wallet.`,
        newBalance: newBalance,
        currency: currency
      });

    } catch (error) {
      console.error('Update wallet error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update wallet balance'
      });
    }
  },

  // GET /admin/transactions - Show all transactions
  transactions: async (req, res) => {
    try {
      // For DataTables, we'll load all transactions without server-side pagination
      const transactions = await Transaction.findAll({
        order: [['created_at', 'DESC']],
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      });

      res.render('admin/transactions', {
        title: 'Transaction Management',
        user: req.session.user,
        transactions,
        stats: {
          total: transactions.length,
          pending: await Transaction.count({ where: { status: 'pending' } }),
          approved: await Transaction.count({ where: { status: 'approved' } }),
          rejected: await Transaction.count({ where: { status: 'rejected' } })
        }
      });
    } catch (error) {
      console.error('Admin transactions error:', error);
      res.render('admin/transactions', {
        title: 'Transaction Management',
        user: req.session.user,
        transactions: [],
        stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
        error: 'Failed to load transactions'
      });
    }
  },

  // POST /admin/transactions/:id/approve - Approve transaction
  approveTransaction: async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await Transaction.findByPk(id, {
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      });

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      if (transaction.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Transaction is not pending' });
      }

      // Update transaction status
      await transaction.update({
        status: 'approved',
        updated_by: req.session.user.name
      });

      // Update user wallet balance
      const wallet = await Wallet.findByUserId(transaction.userId);
      if (wallet) {
        const balanceField = transaction.currency === 'MMK' ? 'balance_mmk' : 'balance_thb';
        await wallet.increment(balanceField, { by: parseFloat(transaction.amount) });
      } else {
        // Create wallet if doesn't exist
        const newWalletData = {
          userId: transaction.userId,
          balance_mmk: transaction.currency === 'MMK' ? parseFloat(transaction.amount) : 0,
          balance_thb: transaction.currency === 'THB' ? parseFloat(transaction.amount) : 0
        };
        await Wallet.create(newWalletData);
      }

      // Send approval email notification
      if (transaction.User && transaction.User.email) {
        console.log(`🔔 Attempting to send approval email to: ${transaction.User.email}`);
        console.log(`📋 Transaction data for email: ID=${transaction.id}, Amount=${transaction.amount}, Currency=${transaction.currency}`);
        try {
          const emailResult = await emailService.sendApprovalEmail(
            transaction.User.email,
            transaction.User.name,
            transaction
          );
          if (emailResult.success) {
            console.log(`✅ Approval email sent successfully to ${transaction.User.email} (Message ID: ${emailResult.messageId})`);
          } else {
            console.error(`❌ Failed to send approval email to ${transaction.User.email}:`, emailResult.error);
          }
        } catch (emailError) {
          console.error('❌ Exception while sending approval email:', emailError);
          // Don't fail the transaction approval if email fails
        }
      } else {
        console.warn(`⚠️ Cannot send approval email - Missing user or email data:`, {
          hasUser: !!transaction.User,
          hasEmail: !!(transaction.User && transaction.User.email),
          userEmail: transaction.User ? transaction.User.email : 'N/A'
        });
      }

      console.log(`✅ Transaction approved: ID ${id} - ${transaction.amount} ${transaction.currency} for user ${transaction.userName}`);

      res.json({
        success: true,
        message: `Transaction approved successfully! ${transaction.amount} ${transaction.currency} added to ${transaction.userName}'s wallet. Email notification sent.`
      });
    } catch (error) {
      console.error('Approve transaction error:', error);
      res.status(500).json({ success: false, message: 'Failed to approve transaction' });
    }
  },

  // POST /admin/transactions/:id/reject - Reject transaction
  rejectTransaction: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const transaction = await Transaction.findByPk(id, {
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      });

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      if (transaction.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Transaction is not pending' });
      }

      const rejectionReason = reason || 'No reason provided';

      // Update transaction status
      await transaction.update({
        status: 'rejected',
        updated_by: req.session.user.name,
        reason: rejectionReason
      });

      // Send rejection email notification
      if (transaction.User && transaction.User.email) {
        console.log(`🔔 Attempting to send rejection email to: ${transaction.User.email}`);
        console.log(`📋 Transaction data for email: ID=${transaction.id}, Amount=${transaction.amount}, Currency=${transaction.currency}, Reason=${rejectionReason}`);
        try {
          const emailResult = await emailService.sendRejectionEmail(
            transaction.User.email,
            transaction.User.name,
            transaction,
            rejectionReason
          );
          if (emailResult.success) {
            console.log(`✅ Rejection email sent successfully to ${transaction.User.email} (Message ID: ${emailResult.messageId})`);
          } else {
            console.error(`❌ Failed to send rejection email to ${transaction.User.email}:`, emailResult.error);
          }
        } catch (emailError) {
          console.error('❌ Exception while sending rejection email:', emailError);
          // Don't fail the transaction rejection if email fails
        }
      } else {
        console.warn(`⚠️ Cannot send rejection email - Missing user or email data:`, {
          hasUser: !!transaction.User,
          hasEmail: !!(transaction.User && transaction.User.email),
          userEmail: transaction.User ? transaction.User.email : 'N/A'
        });
      }

      console.log(`❌ Transaction rejected: ID ${id} - ${transaction.amount} ${transaction.currency} for user ${transaction.userName}. Reason: ${rejectionReason}`);

      res.json({
        success: true,
        message: `Transaction rejected successfully. User: ${transaction.userName}. Email notification sent.`
      });
    } catch (error) {
      console.error('Reject transaction error:', error);
      res.status(500).json({ success: false, message: 'Failed to reject transaction' });
    }
  },

  // Update wallet balance (new direct method)
  updateWalletBalance: async (req, res) => {
    try {
      const { userId } = req.params;
      const { newMMK, newTHB, reason } = req.body;

      // Convert userId to integer
      const userIdInt = parseInt(userId, 10);

      if (isNaN(userIdInt)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      // Validation
      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Reason is required'
        });
      }

      if (newMMK === undefined && newTHB === undefined) {
        return res.status(400).json({
          success: false,
          message: 'At least one balance amount is required'
        });
      }

      // Find user and wallet
      const user = await User.findByPk(userIdInt);
      const wallet = await Wallet.findByUserId(userIdInt);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'User wallet not found'
        });
      }

      // Get current balances
      const currentMMK = parseFloat(wallet.balance_mmk || 0);
      const currentTHB = parseFloat(wallet.balance_thb || 0);

      // Prepare update data
      const updateData = {};
      let changes = [];
      let hasChanges = false;

      if (newMMK !== undefined) {
        const newMMKValue = parseFloat(newMMK);
        if (isNaN(newMMKValue) || newMMKValue < 0) {
          return res.status(400).json({
            success: false,
            message: 'MMK balance must be a valid number and cannot be negative'
          });
        }

        // Check if there's actually a change
        if (Math.abs(newMMKValue - currentMMK) > 0.001) { // Use small epsilon for floating point comparison
          updateData.balance_mmk = newMMKValue;
          changes.push(`MMK: ${currentMMK.toLocaleString()} → ${newMMKValue.toLocaleString()}`);
          hasChanges = true;
        }
      }

      if (newTHB !== undefined) {
        const newTHBValue = parseFloat(newTHB);
        if (isNaN(newTHBValue) || newTHBValue < 0) {
          return res.status(400).json({
            success: false,
            message: 'THB balance must be a valid number and cannot be negative'
          });
        }

        // Check if there's actually a change
        if (Math.abs(newTHBValue - currentTHB) > 0.001) { // Use small epsilon for floating point comparison
          updateData.balance_thb = newTHBValue;
          changes.push(`THB: ${currentTHB.toLocaleString()} → ${newTHBValue.toLocaleString()}`);
          hasChanges = true;
        }
      }

      // If no changes detected, still return success but with appropriate message
      if (!hasChanges) {
        console.log(`Admin ${req.session.user.name} attempted to update wallet for user ${user.name} but no changes were needed`);
        return res.json({
          success: true,
          message: `No changes needed - wallet balances are already set to the specified values for ${user.name}`,
          changes: []
        });
      }

      // Update wallet only if there are changes
      await wallet.update(updateData);

      // Create transaction record for audit trail - calculate the actual change amount
      let transactionAmount = 0;
      let transactionCurrency = 'MMK';

      // Determine the primary change for transaction recording
      if (newMMK !== undefined && updateData.balance_mmk !== undefined) {
        transactionAmount = Math.abs(parseFloat(newMMK) - currentMMK);
        transactionCurrency = 'MMK';
      } else if (newTHB !== undefined && updateData.balance_thb !== undefined) {
        transactionAmount = Math.abs(parseFloat(newTHB) - currentTHB);
        transactionCurrency = 'THB';
      }

      // For cases where both are updated, use the larger change
      if (newMMK !== undefined && newTHB !== undefined &&
        updateData.balance_mmk !== undefined && updateData.balance_thb !== undefined) {
        const mmkChange = Math.abs(parseFloat(newMMK) - currentMMK);
        const thbChange = Math.abs(parseFloat(newTHB) - currentTHB);

        if (mmkChange >= thbChange) {
          transactionAmount = mmkChange;
          transactionCurrency = 'MMK';
        } else {
          transactionAmount = thbChange;
          transactionCurrency = 'THB';
        }
      }

      // Only create transaction if amount is significant (>= 0.01) to avoid validation error
      if (transactionAmount >= 0.01) {
        console.log(`Creating transaction record: amount=${transactionAmount}, currency=${transactionCurrency}`);
        await Transaction.create({
          userId: userIdInt,
          userName: user.name,
          amount: transactionAmount,
          currency: transactionCurrency,
          payment_type: 'Admin Balance Update',
          sender_account_name: req.session.user.name,
          status: 'approved',
          reason: `Balance Update: ${changes.join(', ')} - Reason: ${reason}`,
          updated_by: req.session.user.name
        });
      } else {
        // For very small changes (< 0.01), just log without creating transaction
        console.log(`Small balance change (${transactionAmount} ${transactionCurrency}) - no transaction record created`);
      }

      console.log(`Admin ${req.session.user.name} updated wallet for user ${user.name}: ${changes.join(', ')}`);

      res.json({
        success: true,
        message: `Wallet balances updated successfully for ${user.name}`,
        changes: changes
      });

    } catch (error) {
      console.error('Error updating wallet balance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update wallet balance'
      });
    }
  },



  // GET /admin/reports - Reports & Analytics
  reports: async (req, res) => {
    try {
      // Add cache-busting headers to prevent browser caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      // New URL parameters support
      const { period = '30', startDate, endDate, date, month, range } = req.query;
      let startDateFilter, endDateFilter;

      const setDayRange = (d) => {
        const s = new Date(d);
        s.setHours(0, 0, 0, 0);
        const e = new Date(d);
        e.setHours(23, 59, 59, 999);
        return [s, e];
      };

      const setMonthRange = (yyyyMm) => {
        const [y, m] = yyyyMm.split('-').map(v => parseInt(v, 10));
        const first = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const last = new Date(y, m, 0, 23, 59, 59, 999);
        return [first, last];
      };

      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
      endOfWeek.setHours(23, 59, 59, 999);

      // Precedence: date > month > range > (startDate & endDate) > period
      if (date) {
        [startDateFilter, endDateFilter] = setDayRange(date);
      } else if (month) {
        [startDateFilter, endDateFilter] = setMonthRange(month);
      } else if (range) {
        switch ((range || '').toLowerCase()) {
          case 'today':
            [startDateFilter, endDateFilter] = setDayRange(today);
            break;
          case 'yesterday': {
            const y = new Date(today);
            y.setDate(today.getDate() - 1);
            [startDateFilter, endDateFilter] = setDayRange(y);
            break;
          }
          case 'this_week':
            startDateFilter = startOfWeek;
            endDateFilter = endOfWeek;
            break;
          case 'last_week': {
            const sow = new Date(startOfWeek);
            sow.setDate(sow.getDate() - 7);
            const eow = new Date(endOfWeek);
            eow.setDate(eow.getDate() - 7);
            startDateFilter = sow;
            endDateFilter = eow;
            break;
          }
          case 'this_month': {
            const first = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
            const last = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            startDateFilter = first;
            endDateFilter = last;
            break;
          }
          case 'last_month': {
            const first = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);
            const last = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
            startDateFilter = first;
            endDateFilter = last;
            break;
          }
          default: {
            // Fallback to period
            const days = parseInt(period);
            endDateFilter = new Date();
            endDateFilter.setHours(23, 59, 59, 999);
            startDateFilter = new Date();
            startDateFilter.setDate(startDateFilter.getDate() - days);
            startDateFilter.setHours(0, 0, 0, 0);
          }
        }
      } else if (startDate && endDate) {
        startDateFilter = new Date(startDate);
        startDateFilter.setHours(0, 0, 0, 0);
        endDateFilter = new Date(endDate);
        endDateFilter.setHours(23, 59, 59, 999);
      } else {
        const days = parseInt(period);
        endDateFilter = new Date();
        endDateFilter.setHours(23, 59, 59, 999);
        startDateFilter = new Date();
        startDateFilter.setDate(startDateFilter.getDate() - days);
        startDateFilter.setHours(0, 0, 0, 0);
      }

      console.log(`📊 Reports range → start: ${startDateFilter.toISOString()} end: ${endDateFilter.toISOString()} (period=${period}, date=${date || ''}, month=${month || ''}, range=${range || ''})`);

      // User Registration Statistics (filtered by date)
      const userStats = {
        total: await User.count(),
        active: await User.count({ where: { status: 'active' } }),
        verified: await User.count({ where: { email_verified: true } }),
        newUsers: await User.count({
          where: {
            created_at: {
              [require('sequelize').Op.between]: [startDateFilter, endDateFilter]
            }
          }
        })
      };

      // Transaction Statistics (filtered by date)
      const transactionStats = {
        total: await Transaction.count(), // Total transactions (all time)
        approved: await Transaction.count({
          where: {
            status: 'approved',
            created_at: {
              [require('sequelize').Op.between]: [startDateFilter, endDateFilter]
            }
          }
        }),
        pending: await Transaction.count({
          where: {
            status: 'pending',
            created_at: {
              [require('sequelize').Op.between]: [startDateFilter, endDateFilter]
            }
          }
        }),
        rejected: await Transaction.count({
          where: {
            status: 'rejected',
            created_at: {
              [require('sequelize').Op.between]: [startDateFilter, endDateFilter]
            }
          }
        }),
        recentVolume: await Transaction.count({
          where: {
            created_at: {
              [require('sequelize').Op.between]: [startDateFilter, endDateFilter]
            }
          }
        })
      };

      // Purchase Statistics (filtered by date)
      const purchaseStats = {
        total: await GamePurchaseTransaction.count(), // Total purchases (all time)
        completed: await GamePurchaseTransaction.count({
          where: {
            status: ['completed', 'success', 'partial_success'],
            created_at: {
              [require('sequelize').Op.between]: [startDateFilter, endDateFilter]
            }
          }
        }),
        failed: await GamePurchaseTransaction.count({
          where: {
            status: 'fail',
            created_at: {
              [require('sequelize').Op.between]: [startDateFilter, endDateFilter]
            }
          }
        }),
        recentPurchases: await GamePurchaseTransaction.count({
          where: {
            created_at: {
              [require('sequelize').Op.between]: [startDateFilter, endDateFilter]
            }
          }
        })
      };

      // Revenue Data (from completed purchases - filtered by date)
      const { Sequelize } = require('sequelize');
      const revenueData = await GamePurchaseTransaction.findAll({
        attributes: [
          [Sequelize.fn('DATE', Sequelize.col('created_at')), 'date'],
          'currency',
          [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_amount'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'purchase_count']
        ],
        where: {
          status: ['completed', 'success', 'partial_success'],
          created_at: {
            [Sequelize.Op.between]: [startDateFilter, endDateFilter]
          }
        },
        group: [Sequelize.fn('DATE', Sequelize.col('created_at')), 'currency'],
        order: [[Sequelize.fn('DATE', Sequelize.col('created_at')), 'DESC']]
      });

      // Calculate total revenue by currency (filtered by date)
      const revenueStats = {
        mmk: 0,
        thb: 0
      };

      // Sum up revenue by currency (filtered by date)
      const totalRevenueByCurrency = await GamePurchaseTransaction.findAll({
        attributes: [
          'currency',
          [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_amount']
        ],
        where: {
          status: ['completed', 'success', 'partial_success'],
          created_at: {
            [Sequelize.Op.between]: [startDateFilter, endDateFilter]
          }
        },
        group: ['currency']
      });

      // Calculate totals for each currency
      totalRevenueByCurrency.forEach(item => {
        const currency = item.currency?.toLowerCase();
        const amount = parseFloat(item.dataValues.total_amount || 0);

        if (currency === 'mmk') {
          revenueStats.mmk += amount;
        } else if (currency === 'thb') {
          revenueStats.thb += amount;
        }
      });

      // User Growth Data (filtered by date)
      const userGrowthData = await User.findAll({
        attributes: [
          [Sequelize.fn('DATE', Sequelize.col('created_at')), 'date'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'new_users']
        ],
        where: {
          created_at: {
            [Sequelize.Op.between]: [startDateFilter, endDateFilter]
          }
        },
        group: [Sequelize.fn('DATE', Sequelize.col('created_at'))],
        order: [[Sequelize.fn('DATE', Sequelize.col('created_at')), 'DESC']]
      });

      // Product Performance with revenue by currency (filtered by date)
      const productPerformance = await GamePurchaseTransaction.findAll({
        attributes: [
          'product_id',
          [Sequelize.fn('COUNT', Sequelize.col('GamePurchaseTransaction.id')), 'purchase_count'],
          [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_revenue']
        ],
        where: {
          status: ['completed', 'success', 'partial_success'],
          created_at: {
            [Sequelize.Op.between]: [startDateFilter, endDateFilter]
          }
        },
        include: [{
          model: Product,
          attributes: ['name', 'category', 'price_mmk', 'price_thb'],
          required: true
        }],
        group: [Sequelize.col('GamePurchaseTransaction.product_id'), 'Product.id'],
        order: [[Sequelize.fn('COUNT', Sequelize.col('GamePurchaseTransaction.id')), 'DESC']],
        limit: 10
      });

      // Get revenue breakdown by currency for each product (filtered by date)
      const productRevenueByCurrency = await GamePurchaseTransaction.findAll({
        attributes: [
          'product_id',
          'currency',
          [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'currency_revenue']
        ],
        where: {
          status: ['completed', 'success', 'partial_success'],
          created_at: {
            [Sequelize.Op.between]: [startDateFilter, endDateFilter]
          }
        },
        group: ['product_id', 'currency']
      });

      // Create a map for quick lookup
      const productRevenueMap = {};
      productRevenueByCurrency.forEach(item => {
        const productId = item.product_id;
        const currency = item.currency?.toLowerCase();
        const amount = parseFloat(item.dataValues.currency_revenue || 0);

        if (!productRevenueMap[productId]) {
          productRevenueMap[productId] = { mmk: 0, thb: 0 };
        }

        if (currency === 'mmk') {
          productRevenueMap[productId].mmk += amount;
        } else if (currency === 'thb') {
          productRevenueMap[productId].thb += amount;
        }
      });

      // currency ပေါ်မူတည်ပီး Top Users ထုတ် 
      async function getTopUsersByCurrency(currency, startDateFilter, endDateFilter) {
        return await GamePurchaseTransaction.findAll({
          attributes: [
            'user_id',
            [Sequelize.fn('COUNT', Sequelize.col('GamePurchaseTransaction.id')), 'purchase_count'],
            [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_spent']
          ],
          where: {
            status: ['completed', 'success', 'partial_success'],
            currency: currency,
            created_at: {
              [Sequelize.Op.between]: [startDateFilter, endDateFilter]
            }
          },
          include: [{
            model: User,
            attributes: ['name', 'email'],
            required: true
          }],
          group: [Sequelize.col('GamePurchaseTransaction.user_id'), 'User.id'],
          order: [[Sequelize.fn('SUM', Sequelize.col('total_amount')), 'DESC']],
          limit: 10
        });
      }

      // Top Users by Purchase Volume (filtered by date)
      // Purchase is Model - SHPS
      const topUsersByMMK = await getTopUsersByCurrency('MMK', startDateFilter, endDateFilter);
      const topUsersByTHB = await getTopUsersByCurrency('THB', startDateFilter, endDateFilter);


      // Get customer spending breakdown by currency (filtered by date)
      const customerSpendingByCurrency = await GamePurchaseTransaction.findAll({
        attributes: [
          'user_id',
          'currency',
          [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'currency_spent']
        ],
        where: {
          status: ['completed', 'success', 'partial_success'],
          created_at: {
            [Sequelize.Op.between]: [startDateFilter, endDateFilter]
          }
        },
        group: ['user_id', 'currency']
      });

      // Create a map for quick lookup
      const customerSpendingMap = {};
      customerSpendingByCurrency.forEach(item => {
        const userId = item.user_id;
        const currency = item.currency?.toLowerCase();
        const amount = parseFloat(item.dataValues.currency_spent || 0);

        if (!customerSpendingMap[userId]) {
          customerSpendingMap[userId] = { mmk: 0, thb: 0 };
        }

        if (currency === 'mmk') {
          customerSpendingMap[userId].mmk += amount;
        } else if (currency === 'thb') {
          customerSpendingMap[userId].thb += amount;
        }
      });

      console.log(`✅ Reports generated successfully for period: ${period} days, start: ${startDateFilter.toISOString()}, end: ${endDateFilter.toISOString()}`);

      res.render('admin/reports', {
        title: 'Reports & Analytics',
        user: req.session.user,
        period,
        startDate: startDate || '',
        endDate: endDate || '',
        userStats,
        transactionStats,
        purchaseStats,
        revenueStats,
        revenueData: JSON.stringify(revenueData),
        userGrowthData: JSON.stringify(userGrowthData),
        productPerformance,
        productRevenueMap,
        topUsersByMMK,
        topUsersByTHB,
        customerSpendingMap
      });
    } catch (error) {
      console.error('Reports error:', error);
      res.render('admin/reports', {
        title: 'Reports & Analytics',
        user: req.session.user,
        error: 'Failed to load reports data',
        period: '30',
        startDate: '',
        endDate: '',
        userStats: { total: 0, active: 0, verified: 0, newUsers: 0 },
        transactionStats: { total: 0, approved: 0, pending: 0, rejected: 0, recentVolume: 0 },
        purchaseStats: { total: 0, completed: 0, failed: 0, recentPurchases: 0 },
        revenueStats: { mmk: 0, thb: 0 },
        revenueData: '[]',
        userGrowthData: '[]',
        productPerformance: [],
        productRevenueMap: {},
        topUsersByMMK: [],
        topUsersByTHB: [],
        customerSpendingMap: {}
      });
    }
  },

  // GET /admin/wallets/data - Server-side DataTables endpoint for wallets
  walletsData: async (req, res) => {
    try {
      console.log('🔍 Wallets data endpoint called');
      const { Op } = require('sequelize');

      // DataTables parameters
      const draw = parseInt(req.query.draw) || 1;
      const start = parseInt(req.query.start) || 0;
      const length = parseInt(req.query.length) || 10;
      const searchValue = req.query.search?.value || '';
      const orderColumn = parseInt(req.query.order?.[0]?.column) || 0;
      const orderDir = req.query.order?.[0]?.dir || 'desc';

      // Column mapping for ordering
      const columns = ['id', 'name', 'email', 'role', 'status', 'balance_mmk', 'balance_thb'];
      const orderBy = columns[orderColumn] || 'id';

      // Build search conditions
      let whereCondition = {};
      let walletWhereCondition = {};

      if (searchValue) {
        whereCondition = {
          [Op.or]: [
            { name: { [Op.like]: `%${searchValue}%` } },
            { email: { [Op.like]: `%${searchValue}%` } },
            { role: { [Op.like]: `%${searchValue}%` } },
            { status: { [Op.like]: `%${searchValue}%` } }
          ]
        };
      }

      // Get total count
      const totalRecords = await User.count();

      // Get filtered count
      const filteredRecords = await User.count({
        where: whereCondition,
        include: [
          {
            model: Wallet,
            required: false
          }
        ]
      });

      // Build order clause
      let orderClause;
      if (orderBy === 'balance_mmk' || orderBy === 'balance_thb') {
        orderClause = [[{ model: Wallet }, orderBy, orderDir.toUpperCase()]];
      } else {
        orderClause = [[orderBy, orderDir.toUpperCase()]];
      }

      // Get paginated data
      const users = await User.findAll({
        where: whereCondition,
        include: [
          {
            model: Wallet,
            required: false,
            attributes: ['id', 'balance_mmk', 'balance_thb']
          }
        ],
        order: orderClause,
        limit: length,
        offset: start
      });

      // Format data for DataTables
      const data = users.map(user => [
        `<strong>${user.name}</strong><br><small class="text-muted">ID: ${user.id}</small>`,
        user.email,
        `<span class="badge badge-${user.role === 'admin' ? 'danger' : 'primary'}">${user.role.toUpperCase()}</span>`,
        `<span class="badge badge-${user.status === 'active' ? 'success' : 'secondary'}">${user.status.toUpperCase()}</span>`,
        `<strong class="text-success">${parseFloat(user.Wallet?.balance_mmk || 0).toLocaleString()}</strong> MMK`,
        `<strong class="text-info">${parseFloat(user.Wallet?.balance_thb || 0).toLocaleString()}</strong> THB`,
        `<button class="btn btn-primary btn-sm" onclick="editWallet(${user.id}, '${user.name}', ${user.Wallet?.balance_mmk || 0}, ${user.Wallet?.balance_thb || 0})" title="Edit Wallet">
          <i class="fas fa-edit"></i> Edit
        </button>`
      ]);

      res.json({
        draw: draw,
        recordsTotal: totalRecords,
        recordsFiltered: filteredRecords,
        data: data
      });
    } catch (error) {
      console.error('❌ Wallets data error:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ error: 'Failed to load wallets data', details: error.message });
    }
  },

  // GET /admin/wallets/active - Active Wallets Page
  activeWallets: async (req, res) => {
    try {
      const { Op } = require('sequelize');
      // Get basic stats for the dashboard cards
      const totalUsers = await User.count();

      // Get total balances from wallets directly
      const totalMMK = await Wallet.sum('balance_mmk') || 0;
      const totalTHB = await Wallet.sum('balance_thb') || 0;
      
      // Count active wallets (balance > 0)
      const activeWalletsCount = await Wallet.count({
        where: {
          [Op.or]: [
            { balance_mmk: { [Op.gt]: 0 } },
            { balance_thb: { [Op.gt]: 0 } }
          ]
        }
      });

      const stats = {
        totalUsers,
        totalMMK,
        totalTHB,
        activeUsers: activeWalletsCount // Use this instead of active users status
      };

      res.render('admin/active_wallets', {
        title: 'Active Wallets - ML Diamonds Admin',
        user: req.session.user,
        stats: stats,
        successToast: req.query.successToast,
        errorToast: req.query.errorToast
      });
    } catch (error) {
      console.error('Admin active wallets error:', error);
      res.render('admin/active_wallets', {
        title: 'Active Wallets - ML Diamonds Admin',
        user: req.session.user,
        stats: { totalUsers: 0, totalMMK: 0, totalTHB: 0, activeUsers: 0 },
        errorToast: 'Failed to load wallet data.'
      });
    }
  },

  // GET /admin/wallets/active/data - Data for Active Wallets
  activeWalletsData: async (req, res) => {
    try {
      console.log('🔍 Active Wallets data endpoint called');
      const { Op } = require('sequelize');

      // DataTables parameters
      const draw = parseInt(req.query.draw) || 1;
      const start = parseInt(req.query.start) || 0;
      const length = parseInt(req.query.length) || 10;
      const searchValue = req.query.search?.value || '';
      const orderColumn = parseInt(req.query.order?.[0]?.column) || 0;
      const orderDir = req.query.order?.[0]?.dir || 'desc';

      // Column mapping for ordering
      const columns = ['id', 'name', 'email', 'role', 'status', 'balance_mmk', 'balance_thb'];
      const orderBy = columns[orderColumn] || 'id';

      // Build search conditions
      let whereCondition = {};
      
      if (searchValue) {
        whereCondition = {
          [Op.or]: [
            { name: { [Op.like]: `%${searchValue}%` } },
            { email: { [Op.like]: `%${searchValue}%` } },
            { role: { [Op.like]: `%${searchValue}%` } },
            { status: { [Op.like]: `%${searchValue}%` } }
          ]
        };
      }

      // Wallet condition: MMK > 0 OR THB > 0
      const walletWhereCondition = {
        [Op.or]: [
          { balance_mmk: { [Op.gt]: 0 } },
          { balance_thb: { [Op.gt]: 0 } }
        ]
      };

      // Get total count of users with active wallets
      const totalRecords = await User.count({
        include: [{
          model: Wallet,
          required: true,
          where: walletWhereCondition
        }]
      });

      // Get filtered count
      const filteredRecords = await User.count({
        where: whereCondition,
        include: [{
          model: Wallet,
          required: true,
          where: walletWhereCondition
        }]
      });

      // Build order clause
      let orderClause;
      if (orderBy === 'balance_mmk' || orderBy === 'balance_thb') {
        orderClause = [[{ model: Wallet }, orderBy, orderDir.toUpperCase()]];
      } else {
        orderClause = [[orderBy, orderDir.toUpperCase()]];
      }

      // Get paginated data
      const users = await User.findAll({
        where: whereCondition,
        include: [{
          model: Wallet,
          required: true,
          where: walletWhereCondition,
          attributes: ['id', 'balance_mmk', 'balance_thb']
        }],
        order: orderClause,
        limit: length,
        offset: start
      });

      // Format data for DataTables
      const data = users.map(user => [
        `<strong>${user.name}</strong><br><small class="text-muted">ID: ${user.id}</small>`,
        user.email,
        `<span class="badge badge-${user.role === 'admin' ? 'danger' : 'primary'}">${user.role.toUpperCase()}</span>`,
        `<span class="badge badge-${user.status === 'active' ? 'success' : 'secondary'}">${user.status.toUpperCase()}</span>`,
        `<strong class="text-success">${parseFloat(user.Wallet?.balance_mmk || 0).toLocaleString()}</strong> MMK`,
        `<strong class="text-info">${parseFloat(user.Wallet?.balance_thb || 0).toLocaleString()}</strong> THB`,
        `<button class="btn btn-primary btn-sm" onclick="editWallet(${user.id}, '${user.name}', ${user.Wallet?.balance_mmk || 0}, ${user.Wallet?.balance_thb || 0})" title="Edit Wallet">
          <i class="fas fa-edit"></i> Edit
        </button>`
      ]);

      res.json({
        draw: draw,
        recordsTotal: totalRecords,
        recordsFiltered: filteredRecords,
        data: data
      });
    } catch (error) {
      console.error('❌ Active Wallets data error:', error);
      res.status(500).json({ error: 'Failed to load active wallets data', details: error.message });
    }
  },

  // GET /admin/transactions/data - Server-side DataTables endpoint for transactions
  transactionsData: async (req, res) => {
    try {
      const { Op } = require('sequelize');

      // DataTables parameters
      const draw = parseInt(req.query.draw) || 1;
      const start = parseInt(req.query.start) || 0;
      const length = parseInt(req.query.length) || 10;
      const searchValue = req.query.search?.value || '';
      const orderColumn = parseInt(req.query.order?.[0]?.column) || 0;
      const orderDir = req.query.order?.[0]?.dir || 'desc';

      // Column mapping for ordering
      const columns = ['id', 'userName', 'amount', 'currency', 'payment_type', 'sender_account_name', 'screenshot', 'status', 'created_at'];
      const orderBy = columns[orderColumn] || 'id';

      // Build search conditions
      let whereCondition = {};
      let userWhereCondition = {};

      if (searchValue) {
        whereCondition = {
          [Op.or]: [
            { amount: { [Op.like]: `%${searchValue}%` } },
            { currency: { [Op.like]: `%${searchValue}%` } },
            { payment_type: { [Op.like]: `%${searchValue}%` } },
            { sender_account_name: { [Op.like]: `%${searchValue}%` } },
            { status: { [Op.like]: `%${searchValue}%` } },
            { reason: { [Op.like]: `%${searchValue}%` } }
          ]
        };

        userWhereCondition = {
          [Op.or]: [
            { name: { [Op.like]: `%${searchValue}%` } },
            { email: { [Op.like]: `%${searchValue}%` } }
          ]
        };
      }

      // Get total count
      const totalRecords = await Transaction.count();

      // Get filtered count
      const filteredRecords = await Transaction.count({
        where: whereCondition,
        include: [
          {
            model: User,
            where: Object.keys(userWhereCondition).length > 0 ? userWhereCondition : undefined,
            required: Object.keys(userWhereCondition).length > 0
          }
        ]
      });

      // Build order clause
      let orderClause;
      if (orderBy === 'userName') {
        orderClause = [[User, 'name', orderDir.toUpperCase()]];
      } else {
        orderClause = [[orderBy, orderDir.toUpperCase()]];
      }

      // Get paginated data
      const transactions = await Transaction.findAll({
        where: whereCondition,
        include: [
          {
            model: User,
            attributes: ['id', 'name', 'email'],
            where: Object.keys(userWhereCondition).length > 0 ? userWhereCondition : undefined,
            required: Object.keys(userWhereCondition).length > 0
          }
        ],
        order: orderClause,
        limit: length,
        offset: start
      });

      // Format data for DataTables
      const data = transactions.map(transaction => [
        `#${transaction.id}`,
        `<strong>${transaction.User?.name || 'N/A'}</strong><br><small class="text-muted">ID: ${transaction.userId}</small>`,
        `<strong>${parseFloat(transaction.amount).toLocaleString()}</strong>`,
        `<span class="badge badge-${transaction.currency === 'MMK' ? 'info' : 'warning'}">${transaction.currency}</span>`,
        transaction.payment_type,
        `<strong>${transaction.sender_account_name}</strong>`,
        transaction.screenshot ?
          `<button class="btn btn-sm btn-outline-primary" onclick="viewScreenshot('${transaction.screenshot}')">
            <i class="fas fa-image"></i> View
          </button>` :
          '<span class="text-muted">No screenshot</span>',
        `<span class="badge badge-${transaction.status === 'pending' ? 'warning' :
          transaction.status === 'approved' ? 'success' : 'danger'
        }" id="status-${transaction.id}">${transaction.status === 'pending' ? 'Pending' :
          transaction.status === 'approved' ? 'Approved' : 'Rejected'
        }</span>
        ${transaction.updated_by ? `<br><small class="text-muted">by ${transaction.updated_by}</small>` : ''}
        ${transaction.reason ? `<br><small class="text-danger">Reason: ${transaction.reason}</small>` : ''}`,
        `<small>${transaction.created_at ? new Date(transaction.created_at).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Asia/Yangon'
        }) : ''}</small>`,
        transaction.status === 'pending' ?
          `<button class="btn btn-sm btn-success mr-1" onclick="approveTransaction(${transaction.id})" title="Approve Transaction">
            <i class="fas fa-check"></i> Approve
          </button>
          <button class="btn btn-sm btn-danger" onclick="rejectTransaction(${transaction.id})" title="Reject Transaction">
            <i class="fas fa-times"></i> Reject
          </button>` :
          '<span class="text-muted">No actions</span>'
      ]);

      res.json({
        draw: draw,
        recordsTotal: totalRecords,
        recordsFiltered: filteredRecords,
        data: data
      });
    } catch (error) {
      console.error('Transactions data error:', error);
      res.status(500).json({ error: 'Failed to load transactions data' });
    }
  }
};

module.exports = adminController; 
