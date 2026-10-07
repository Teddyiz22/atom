const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductCategory = sequelize.define('ProductCategory', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  productTypeId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'product_type_id'
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  sortOrder: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_order'
  },
  iconPath: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'icon_path'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'product_categories',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['product_type_id', 'slug'] },
    { fields: ['product_type_id', 'sort_order'] }
  ]
});

ProductCategory.associate = function (models) {
  ProductCategory.belongsTo(models.ProductType, {
    foreignKey: 'productTypeId',
    as: 'productType'
  });
  ProductCategory.hasMany(models.Product, {
    foreignKey: 'categoryId',
    as: 'products'
  });
};

module.exports = ProductCategory;
