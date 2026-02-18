const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  userName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  payment_type: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Account type (e.g., KBZ Pay, Wave, CB Pay, AYA Bank)'
  },
  sender_account_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Sender account name (e.g., John Doe, Mary)'
  },
  // sender_account_number field removed - no longer needed
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0.01
    }
  },
  currency: {
    type: DataTypes.ENUM('MMK', 'THB'),
    allowNull: false,
    defaultValue: 'MMK'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    allowNull: false
  },
  screenshot: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'User uploads proof of payment'
  },
  updated_by: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Admin who updated the transaction'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for rejection'
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
  tableName: 'transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['currency']
    },
    {
      fields: ['created_at']
    }
  ]
});

// Static methods
Transaction.findByUserId = function (userId) {
  return this.findAll({
    where: { userId },
    order: [['created_at', 'DESC']]
  });
};

Transaction.findByStatus = function (status) {
  return this.findAll({
    where: { status },
    order: [['created_at', 'ASC']]
  });
};

Transaction.findByCurrency = function (currency) {
  return this.findAll({
    where: { currency },
    order: [['created_at', 'DESC']]
  });
};

Transaction.findByStatusAndCurrency = function (status, currency) {
  return this.findAll({
    where: { status, currency },
    order: [['created_at', 'ASC']]
  });
};

Transaction.getPendingCount = function () {
  return this.count({ where: { status: 'pending' } });
};

Transaction.updateStatus = async function (transactionId, newStatus, adminUser, reason = null) {
  const transaction = await this.findByPk(transactionId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  const updateData = {
    status: newStatus,
    updated_by: adminUser
  };

  if (reason) {
    updateData.reason = reason;
  }

  await transaction.update(updateData);
  return transaction;
};

module.exports = Transaction; 