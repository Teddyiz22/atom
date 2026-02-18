const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserActivityLog = sequelize.define('UserActivityLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Can be null for anonymous activities
        references: {
            model: 'users',
            key: 'id'
        }
    },
    action_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'LOGIN, LOGOUT, REGISTRATION, WALLET_TOPUP, PURCHASE, etc.'
    },
    user_email: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'Supports both IPv4 and IPv6'
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    session_id: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional activity-specific data'
    },
    success: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true
    },
    risk_level: {
        type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
        allowNull: true,
        defaultValue: 'LOW'
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'user_activity_logs',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['action_type']
        },
        {
            fields: ['created_at']
        }
    ]
});

// Define associations
UserActivityLog.associate = (models) => {
    if (models.User) {
        UserActivityLog.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }
};

module.exports = UserActivityLog;