const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const G2BulkItem = sequelize.define('G2BulkItem', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  g2bulkProductId: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'g2bulk_items',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['product_id'] },
    { unique: true, fields: ['product_id', 'g2bulk_product_id'] }
  ]
});

G2BulkItem.associate = function(models) {
  G2BulkItem.belongsTo(models.Product, { foreignKey: 'productId' });
};

module.exports = G2BulkItem;
