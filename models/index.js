const { sequelize } = require('../config/database');// Import all models
const User = require('./User');
const Product = require('./Product');
const Transaction = require('./Transaction');
const Wallet = require('./Wallet');
const Blog = require('./Blog');
const UserActivityLog = require('./UserActivityLog');
const ProductType = require('./ProductType');
const PaymentMethod = require('./PaymentMethod');
const SmileSubItem = require('./SmileSubItem');
const G2BulkItem = require('./G2BulkItem');
const GamePurchaseTransaction = require('./GamePurchaseTransaction');
const SystemSetting = require('./SystemSetting');

// Create models object
const models = {
    User,
    Product,
    Blog,
    ProductType,
    Transaction,
    Wallet,
    UserActivityLog,
    PaymentMethod,
    SmileSubItem,
    G2BulkItem,
    GamePurchaseTransaction,
    SystemSetting
};

// Set up associations if they exist
Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

// Export models and sequelize instance
module.exports = {
    ...models,
    sequelize
};
