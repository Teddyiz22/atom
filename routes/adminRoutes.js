const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminAuth, adminApiAuth } = require('../middleware/adminAuth');
const adminLayout = require('../middleware/adminLayout');
const productController = require('../controllers/productController');
const blogController = require('../controllers/blogController');

// Admin Dashboard (requires auth + layout)
router.get('/', adminAuth, adminLayout, adminController.dashboard);

// User Management (requires auth + layout for pages, auth only for API)
router.get('/users', adminAuth, adminLayout, adminController.users);
router.get('/register-user', adminAuth, adminLayout, adminController.showRegisterUser);
router.post('/register-user', adminAuth, adminController.registerUser);
router.get('/users/unverifiedList', adminAuth, adminLayout, adminController.invalidUsers);
router.get('/users/unverifiedList/data', adminAuth, adminController.unverifiedUsersData);
router.get('/users/data', adminAuth, adminController.usersData);
router.post('/users/:id/toggle-status', adminApiAuth, adminController.toggleUserStatus);
router.delete('/users/:id', adminApiAuth, adminController.deleteUser);

//VERIFY THE USRES
router.post('/users/:id/verify', adminApiAuth, adminController.verifyUser);
router.post(
  '/users/approve-all',
  adminApiAuth,
  adminController.approveAllUsers
);


// Product Management (legacy pages)
router.get('/products', adminAuth, (req, res) => res.redirect('/admin/product-management'));
router.get('/products/new', adminAuth, (req, res) => res.redirect('/admin/product-management'));
router.post('/products', adminAuth, productController.create);
router.post('/products/bulk-action', adminApiAuth, productController.bulkAction);
router.get('/products/:id/edit', adminAuth, (req, res) => res.redirect('/admin/product-management'));
router.get('/products/:id', adminAuth, (req, res) => res.redirect('/admin/product-management'));

// API route for updating products (returns JSON)
router.post('/products/:id/update', adminApiAuth, productController.updateAPI);

router.post('/products/:id/toggle-status', adminApiAuth, productController.toggleStatus);
router.delete('/products/:id', adminAuth, productController.delete);

// Product Management (provider flows)
router.get('/product-management', adminAuth, adminLayout, adminController.productManagement);
router.get('/product-management/:provider', adminAuth, adminLayout, adminController.productManagementProvider);
router.get('/product-management/:provider/:typeCode', adminAuth, adminLayout, adminController.productManagementProductList);
router.get('/product-management/:provider/:typeCode/new', adminAuth, adminLayout, adminController.productManagementNewProduct);
router.post('/product-management/:provider/:typeCode/new', adminAuth, adminController.productManagementCreateProduct);
router.get('/product-management/:provider/:typeCode/edit/:id', adminAuth, adminLayout, adminController.productManagementEditProduct);
router.post('/product-management/:provider/:typeCode/edit/:id', adminAuth, adminController.productManagementUpdateProduct);
router.post('/product-management/:provider/:typeCode/toggle-status/:id', adminAuth, adminController.productManagementToggleStatus);
router.post('/product-management/:provider/:typeCode/toggle-featured/:id', adminAuth, adminController.productManagementToggleFeatured);
router.post('/product-management/:provider/:typeCode/delete/:id', adminAuth, adminController.productManagementDeleteProduct);
router.post('/product-management/g2bulk/save-price', adminAuth, adminController.saveG2BulkPrice);

// Admin Settings (requires auth + layout)
router.get('/settings', adminAuth, adminLayout, adminController.settings);

// Product Types (requires auth + layout)
router.get('/product-types', adminAuth, adminLayout, adminController.productTypes);
router.post('/product-types/save', adminAuth, adminController.upsertProductType);
router.post('/product-types/toggle', adminAuth, adminController.toggleProductTypeStatus);
router.post('/product-types/delete', adminAuth, adminController.deleteProductType);

// Payment Methods (requires auth + layout)
router.get('/payment-methods', adminAuth, adminLayout, adminController.paymentMethods);
router.post('/payment-methods/save', adminAuth, adminController.upsertPaymentMethod);
router.post('/payment-methods/delete', adminAuth, adminController.deletePaymentMethod);

// Game Purchase Transactions (requires auth + layout)
router.get('/game-purchase-transactions', adminAuth, adminLayout, adminController.gamePurchaseTransactions);
router.get('/game-purchase-transactions/data', adminAuth, adminController.gamePurchaseTransactionsData);
router.post('/game-purchase-transactions/:id/approve-manual', adminApiAuth, adminController.approveManualGamePurchase);
router.post('/game-purchase-transactions/:id/reject-manual', adminApiAuth, adminController.rejectManualGamePurchase);

// Maintenance Mode API (requires API auth only)
router.get('/maintenance/status', adminApiAuth, adminController.getMaintenanceStatus);
router.post('/maintenance/toggle', adminApiAuth, adminController.toggleMaintenanceMode);

// Maintenance Preview (requires auth only, no layout)
router.get('/maintenance-preview', adminAuth, adminController.maintenancePreview);

// Wallet Management (requires auth + layout for pages, auth only for API)
router.get('/wallets', adminAuth, adminLayout, adminController.wallets);
router.get('/wallets/data', adminAuth, adminController.walletsData);
router.get('/wallets/active', adminAuth, adminLayout, adminController.activeWallets);
router.get('/wallets/active/data', adminAuth, adminController.activeWalletsData);
router.post('/wallets/:userId/update', adminApiAuth, adminController.updateWallet);
router.post('/wallets/:userId/update-balance', adminApiAuth, adminController.updateWalletBalance);

// Transaction Management (requires auth + layout for pages, auth only for API)
router.get('/transactions', adminAuth, adminLayout, adminController.transactions);
router.get('/transactions/data', adminAuth, adminController.transactionsData);
router.post('/transactions/:id/approve', adminApiAuth, adminController.approveTransaction);
router.post('/transactions/:id/reject', adminApiAuth, adminController.rejectTransaction);

// Purchase Management (legacy routes removed)
// router.get('/purchases', adminAuth, adminLayout, adminController.purchases);
// router.get('/purchases/data', adminAuth, adminController.purchasesData);
// router.get('/purchases/:id', adminAuth, adminController.purchaseDetails);

// Reports & Analytics (requires auth + layout)
// Add cache-busting middleware for reports
const noCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
};

router.get('/reports', adminAuth, adminLayout, noCache, adminController.reports);

// Blog Management
router.get('/blogs', adminAuth, adminLayout, blogController.adminIndex);
router.get('/blogs/create', adminAuth, adminLayout, blogController.create);
router.post('/blogs/create', adminAuth, blogController.store);
router.get('/blogs/edit/:id', adminAuth, adminLayout, blogController.edit);
router.post('/blogs/update/:id', adminAuth, blogController.update);
router.post('/blogs/toggle-status/:id', adminAuth, blogController.toggleStatus);
router.delete('/blogs/:id', adminAuth, blogController.destroy);

module.exports = router; 
