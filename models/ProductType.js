const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductType = sequelize.define('ProductType', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  typeCode: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  provider: {
    type: DataTypes.ENUM('smile', 'g2bulk', 'manual'),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('game', 'voucher'),
    allowNull: false,
    defaultValue: 'game'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'product_types',
  underscored: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ['provider', 'type_code'] }]
});

module.exports = ProductType;
