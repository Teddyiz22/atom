const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  productTypeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'product_type_id'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  diamond_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  price_mmk: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  price_thb: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  category: {
    type: DataTypes.ENUM('DIAMOND', 'DOUBLE_DIAMOND', 'WEEKLY_PASS', 'TWILIGHT_PASS'),
    allowNull: true
  },
  smileIDCombination: {
    type: DataTypes.STRING(256),
    allowNull: true,
    field: 'smile_id_combination'
  },
  region: {
    type: DataTypes.ENUM('b', 'ph'),
    allowNull: false,
    defaultValue: 'b'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  image_path: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  sort_order: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0
  },
}, {
  tableName: 'products',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Static methods
Product.findActive = function () {
  return this.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC'], ['diamond_amount', 'ASC']]
  });
};

Product.findByCategory = function (category) {
  return this.findAll({
    where: {
      category: category,
      is_active: true
    },
    order: [['sort_order', 'ASC'], ['diamond_amount', 'ASC']]
  });
};

Product.findFeatured = function () {
  return this.findAll({
    where: {
      is_featured: true,
      is_active: true
    },
    order: [['sort_order', 'ASC']]
  });
};

module.exports = Product; 
