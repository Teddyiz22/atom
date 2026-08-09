const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SmileCoinRate = sequelize.define('SmileCoinRate', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  region: {
    type: DataTypes.ENUM('b', 'ph'),
    allowNull: false
  },
  rate_mmk: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0
  },
  rate_thb: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'smile_coin_rates',
  underscored: true,
  timestamps: true
});

module.exports = SmileCoinRate;
