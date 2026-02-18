const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentMethod = sequelize.define('PaymentMethod', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  account_number: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  account_name: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  payment_type: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  region: {
    type: DataTypes.ENUM('Myanmar', 'Thailand'),
    allowNull: false
  },
  is_active: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'payment_methods',
  underscored: true,
  timestamps: true
});

module.exports = PaymentMethod;
