const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GamePurchaseTransaction = sequelize.define('GamePurchaseTransaction', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  user_name: { type: DataTypes.STRING(100), allowNull: false },
  provider: { type: DataTypes.ENUM('g2bulk', 'smile'), allowNull: false },
  product_type_code: { type: DataTypes.STRING(64), allowNull: false },
  product_id: { type: DataTypes.STRING(64), allowNull: false },
  product_name: { type: DataTypes.STRING(128), allowNull: false },
  player_id: { type: DataTypes.STRING(64), allowNull: true },
  server_id: { type: DataTypes.STRING(64), allowNull: true },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  callback_url: { type: DataTypes.TEXT, allowNull: true },
  idempotency_key: { type: DataTypes.STRING(128), allowNull: true, unique: true },
  total_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  currency: { type: DataTypes.ENUM('MMK', 'THB'), allowNull: false, defaultValue: 'MMK' },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'fail', 'success', 'partial_success'),
    allowNull: false,
    defaultValue: 'pending'
  },
  order_id: { type: DataTypes.STRING(64), allowNull: true },
  transaction_id: { type: DataTypes.STRING(64), allowNull: true },
  delivery_items: { type: DataTypes.TEXT, allowNull: true },
  refunded_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: true, defaultValue: 0 },
  refund_items: { type: DataTypes.TEXT, allowNull: true },
  failure_reason: { type: DataTypes.TEXT, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'game_purchase_transactions',
  timestamps: false,
  underscored: true,
  indexes: [
    { unique: true, fields: ['idempotency_key'] },
    { fields: ['created_at'] },
    { fields: ['user_id'] },
    { fields: ['provider'] },
    { fields: ['status'] }
  ]
});

module.exports = GamePurchaseTransaction;
