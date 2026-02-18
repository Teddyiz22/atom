const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SmileSubItem = sequelize.define('SmileSubItem', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  smileProductId: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  region: {
    type: DataTypes.ENUM('b', 'ph'),
    allowNull: false,
    defaultValue: 'b'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  },
  sortOrder: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  }
}, {
  tableName: 'smile_sub_items',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['product_id'] },
    { unique: true, fields: ['product_id', 'smile_product_id', 'region'] }
  ]
});

module.exports = SmileSubItem;
