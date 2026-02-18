const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sequelize } = require('../config/database');

class User extends Model {
  // Instance method to check password
  async checkPassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  // Instance method to generate password reset token
  generatePasswordResetToken() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.password_reset_token = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Token expires in 10 minutes
    this.password_reset_expires = new Date(Date.now() + 10 * 60 * 1000);

    return resetToken;
  }

  // Instance method to get user data without password
  toJSON() {
    const user = { ...this.get() };
    delete user.password;
    delete user.password_reset_token;
    delete user.password_reset_expires;
    return user;
  }

  // Static method to create user with hashed password
  static async createUser(userData) {
    const { name, email, password, phoneNumber } = userData;

    // Don't hash password here - let the Sequelize hook handle it
    return await User.create({
      name,
      email,
      phone_number: phoneNumber,
      password: password, // Raw password - will be hashed by beforeCreate hook
    });
  }

  // Static method to authenticate user
  static async authenticate(email, password) {
    try {
      const user = await User.findOne({
        where: { email },
        attributes: ['id', 'name', 'email', 'phone_number', 'password', 'role', 'status', 'email_verified', 'last_login']
      });

      if (!user) {
        return null;
      }

      if (user.status !== 'active') {
        if (user.status === 'inactive') {
          throw new Error('Account is disabled');
        } else if (user.status === 'suspended') {
          throw new Error('Account is suspended');
        } else {
          throw new Error('Account is not active');
        }
      }

      // Check email verification
      if (!user.email_verified) {
        throw new Error('Please verify your email address before logging in. Check your email for the verification link.');
      }

      const isPasswordValid = await user.checkPassword(password);
      if (!isPasswordValid) {
        return null;
      }

      // Update last login
      await user.update({ last_login: new Date() });

      return user;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  // Static method to find user by email
  static async findByEmail(email) {
    return await User.findOne({ where: { email } });
  }

  // Static method to find user by reset token
  static async findByResetToken(token) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    return await User.findOne({
      where: {
        password_reset_token: hashedToken,
        password_reset_expires: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      }
    });
  }

  // Static method to update password
  static async updatePassword(userId, newPassword) {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    return await User.update(
      {
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null
      },
      { where: { id: userId } }
    );
  }

  // Generate email verification token
  generateEmailVerificationToken() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.email_verification_token = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Token expires in 24 hours
    this.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return resetToken;
  }

  // Static method to find user by verification token
  static async findByVerificationToken(token) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    return await User.findOne({
      where: {
        email_verification_token: hashedToken,
        email_verification_expires: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      }
    });
  }

  // Static method to verify email
  static async verifyEmail(userId) {
    return await User.update(
      {
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null
      },
      { where: { id: userId } }
    );
  }
}

// Define the User model
User.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Name is required'
      },
      len: {
        args: [2, 255],
        msg: 'Name must be between 2 and 255 characters'
      }
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: {
      msg: 'Email address already exists'
    },
    validate: {
      isEmail: {
        msg: 'Must be a valid email address'
      },
      notEmpty: {
        msg: 'Email is required'
      }
    }
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      len: {
        args: [10, 20],
        msg: 'Phone number must be between 10 and 20 characters'
      }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: {
        args: [6, 255],
        msg: 'Password must be at least 6 characters long'
      }
    }
  },
  googleId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
  },
  profilePicture: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  avatar: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active',
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  password_reset_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  password_reset_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  email_verification_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  email_verification_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['phone_number']
    },
    {
      fields: ['status']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    // Hash password before creating user
    beforeCreate: async (user) => {
      if (user.password && !user.password.startsWith('$2b$')) {
        const saltRounds = 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    },
    // Hash password before updating if changed
    beforeUpdate: async (user) => {
      if (user.password && user.changed('password') && !user.password.startsWith('$2b$')) {
        const saltRounds = 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    },
    // Create wallet for new user with 0 balance
    afterCreate: async (user) => {
      const Wallet = require('./Wallet');
      await Wallet.create({
        userId: user.id,
        balance_mmk: 0.00,
        balance_thb: 0.00
      });
      console.log(`💰 Wallet created for user: ${user.name}`);
    }
  }
});

module.exports = User; 
