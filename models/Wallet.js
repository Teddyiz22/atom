const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  balance_mmk: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  balance_thb: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'wallets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['userId']
    }
  ]
});

// Define associations
Wallet.associate = function (models) {
  Wallet.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'User'
  });
};

// Static methods
Wallet.findByUserId = function (userId) {
  return this.findOne({ where: { userId } });
};

Wallet.updateBalance = async function (userId, currency, amount, updatedBy) {
  const wallet = await this.findByUserId(userId);
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const balanceField = currency === 'MMK' ? 'balance_mmk' : 'balance_thb';
  const newBalance = parseFloat(wallet[balanceField]) + parseFloat(amount);

  await wallet.update({ [balanceField]: newBalance });
  return wallet;
};

Wallet.getAllWallets = function () {
  const User = require('./User');
  return this.findAll({
    include: [{
      model: User,
      attributes: ['id', 'name', 'email', 'role']
    }],
    order: [['created_at', 'DESC']]
  });
};

module.exports = Wallet; 