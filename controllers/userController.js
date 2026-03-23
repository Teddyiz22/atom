const User = require('../models/User');
const emailService = require('../services/emailService');
const loggingService = require('../services/loggingService');
const { logUserActivity } = require('../services/loggingService');

const userController = {
  // GET /users/login
  showLogin: (req, res) => {
    res.render('users/login', {
      title: 'Login',
      user: req.session.user || null
    });
  },

  // POST /users/login
  login: async (req, res) => {
    console.log('🔍 Login attempt:', req.body);
    const { email, password, remember } = req.body;

    try {
      // Log login attempt
      await logUserActivity(null, 'LOGIN_ATTEMPT', {
        email: email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        rememberMe: !!remember
      });

      // Basic validation
      if (!email || !password) {
        console.log('❌ Login failed: Missing email or password');

        // Log validation failure
        await logUserActivity(null, 'LOGIN_VALIDATION_FAILED', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          missingFields: {
            email: !email,
            password: !password
          }
        });

        return res.render('users/login', {
          title: 'Login',
          user: null,
          errorToast: 'Email and password are required.'
        });
      }

      console.log('🔍 Attempting to authenticate user:', email);

      // Authenticate user using Sequelize model
      const user = await User.authenticate(email, password);
      console.log('🔍 Authentication result:', user ? 'SUCCESS' : 'FAILED');

      if (user) {
        // Regenerate session ID for security (prevent session fixation attacks)
        const oldSessionId = req.sessionID;
        req.session.regenerate((err) => {
          if (err) {
            console.error('❌ Session regeneration failed:', err);
            return res.render('users/login', {
              title: 'Login',
              user: null,
              errorToast: 'Login failed due to security error. Please try again.'
            });
          }

          console.log('🔄 Session regenerated on login:', {
            oldSessionId: oldSessionId,
            newSessionId: req.sessionID,
            userId: user.id
          });

          // Log successful login
          logUserActivity(user.id, 'LOGIN_SUCCESS', {
            userEmail: user.email,
            userName: user.name,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            rememberMe: !!remember,
            sessionDuration: remember ? '30 days' : 'session'
          });

          // Store user in session (without password)
          req.session.user = user.toJSON();

          // Handle remember me functionality
          if (remember) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            console.log('✅ Remember me enabled for 30 days');
          } else {
            req.session.cookie.maxAge = null; // Session cookie (expires when browser closes)
          }

          // Store login success message in session
          req.session.loginSuccess = true;
          req.session.successMessage = `Welcome back, ${user.name}! You have successfully logged in.`;

          console.log('✅ Login successful, redirecting to shop');
          res.redirect('/shop');
        });
      } else {
        console.log('❌ Login failed: Invalid credentials');

        // Log failed login attempt
        await logUserActivity(null, 'LOGIN_FAILED', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          reason: 'Invalid credentials'
        });

        res.render('users/login', {
          title: 'Login',
          user: null,
          errorToast: 'Invalid email or password.'
        });
      }
    } catch (error) {
      console.error('❌ Login error:', error);

      // Log login error
      await loggingService.logError(null, 'LOGIN_ERROR', error, {
        email: email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        errorType: error.message
      });

      // Handle email verification required error
      if (error.message.includes('verify your email')) {
        // Log email verification required
        await logUserActivity(null, 'LOGIN_EMAIL_VERIFICATION_REQUIRED', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/login', {
          title: 'Login',
          user: null,
          errorToast: error.message,
          showResendVerification: true,
          userEmail: email || ''
        });
      }

      // Handle account status errors with specific messages
      if (error.message.includes('Account is disabled')) {
        // Log disabled account login attempt
        await logUserActivity(null, 'LOGIN_DISABLED_ACCOUNT', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/login', {
          title: 'Login',
          user: null,
          errorToast: 'Your account has been disabled. Please contact our support team at support@atomgameshop.com for assistance.'
        });
      }

      if (error.message.includes('Account is suspended')) {
        // Log suspended account login attempt
        await logUserActivity(null, 'LOGIN_SUSPENDED_ACCOUNT', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/login', {
          title: 'Login',
          user: null,
          errorToast: 'Your account has been suspended due to policy violations. Please contact support@atomgameshop.com to resolve this issue.'
        });
      }

      if (error.message.includes('Account is not active')) {
        // Log inactive account login attempt
        await logUserActivity(null, 'LOGIN_INACTIVE_ACCOUNT', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/login', {
          title: 'Login',
          user: null,
          errorToast: 'Your account is currently not active. Please contact support@atomgameshop.com for assistance.'
        });
      }

      res.render('users/login', {
        title: 'Login',
        user: null,
        errorToast: 'Something went wrong. Please try again.'
      });
    }
  },

  // GET /users/register
  showRegister: (req, res) => {
    res.render('users/register', {
      title: 'Register',
      user: req.session.user || null
    });
  },

  // POST /users/register
  register: async (req, res) => {
    try {
      console.log('🔍 Registration attempt:', req.body);
      const { fullName, email, phoneNumber, password, confirmPassword, terms } = req.body;

      // Log registration attempt
      await logUserActivity(null, 'REGISTRATION_ATTEMPT', {
        email: email,
        fullName: fullName,
        phoneNumber: phoneNumber,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Basic validation
      if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
        console.log('❌ Registration failed: Missing required fields');

        // Log validation failure
        await logUserActivity(null, 'REGISTRATION_VALIDATION_FAILED', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          missingFields: {
            fullName: !fullName,
            email: !email,
            phoneNumber: !phoneNumber,
            password: !password,
            confirmPassword: !confirmPassword
          }
        });

        return res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: 'All fields are required.'
        });
      }

      if (!terms) {
        console.log('❌ Registration failed: Terms not accepted');

        // Log terms not accepted
        await logUserActivity(null, 'REGISTRATION_TERMS_NOT_ACCEPTED', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: 'You must agree to the Terms of Service and Privacy Policy.'
        });
      }

      if (password !== confirmPassword) {
        console.log('❌ Registration failed: Passwords do not match');

        // Log password mismatch
        await logUserActivity(null, 'REGISTRATION_PASSWORD_MISMATCH', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: 'Passwords do not match.'
        });
      }

      if (password.length < 6) {
        console.log('❌ Registration failed: Password too short');

        // Log weak password
        await logUserActivity(null, 'REGISTRATION_WEAK_PASSWORD', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          passwordLength: password.length
        });

        return res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: 'Password must be at least 6 characters long.'
        });
      }

      console.log('🔍 Checking if user already exists:', email);

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        console.log('❌ Registration failed: User already exists');

        // Log duplicate email attempt
        await logUserActivity(null, 'REGISTRATION_DUPLICATE_EMAIL', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: 'An account with this email already exists.'
        });
      }

      console.log('🔍 Creating new user...');

      // Create new user using Sequelize model
      const newUser = await User.createUser({
        name: fullName,
        email,
        password,
        phoneNumber
      });

      console.log('🔍 User creation result:', newUser ? 'SUCCESS' : 'FAILED');

      if (newUser) {
        console.log('✅ User created successfully:', newUser.id);

        // Log successful user creation
        await logUserActivity(newUser.id, 'REGISTRATION_USER_CREATED', {
          userEmail: newUser.email,
          userName: newUser.name,
          userPhone: newUser.phoneNumber,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        // Generate email verification token
        const verificationToken = newUser.generateEmailVerificationToken();
        await newUser.save();

        // Send verification email
        console.log('📧 Sending verification email to:', email);
        const emailResult = await emailService.sendVerificationEmail(email, fullName, verificationToken);

        if (emailResult.success) {
          console.log('✅ Verification email sent successfully');

          // Log successful email sending
          await logUserActivity(newUser.id, 'REGISTRATION_EMAIL_SENT', {
            userEmail: newUser.email,
            userName: newUser.name,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });

          // Redirect to verification pending page
          req.session.pendingVerification = {
            email: email,
            name: fullName,
            message: 'Registration successful! Please check your email to verify your account.'
          };
          res.redirect('/users/verification-pending');
        } else {
          console.log('❌ Failed to send verification email:', emailResult.error);

          // Log email sending failure
          await loggingService.logError(newUser.id, 'REGISTRATION_EMAIL_FAILED', new Error(emailResult.error), {
            userEmail: newUser.email,
            userName: newUser.name,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });

          // If email fails, still allow user to continue but show warning
          req.session.user = newUser.toJSON();
          req.session.registrationSuccess = true;
          req.session.successMessage = `Welcome to ATOM Game Shop, ${newUser.name}! Your account has been created. Please verify your email when possible.`;
          res.redirect('/shop');
        }
      } else {
        console.log('❌ Registration failed: User creation returned null');

        // Log user creation failure
        await logUserActivity(null, 'REGISTRATION_USER_CREATION_FAILED', {
          email: email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          reason: 'User creation returned null'
        });

        res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: 'Registration failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('❌ Registration error:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);

      // Log registration error
      await loggingService.logError(null, 'REGISTRATION_ERROR', error, {
        email: req.body.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        errorType: error.name,
        errorMessage: error.message
      });

      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError') {
        const errorMessage = error.errors.map(err => err.message).join(', ');
        console.log('❌ Sequelize validation error:', errorMessage);

        // Log specific validation error
        await logUserActivity(null, 'REGISTRATION_SEQUELIZE_VALIDATION_ERROR', {
          email: req.body.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          validationErrors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });

        return res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: errorMessage
        });
      }

      // Handle unique constraint errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        console.log('❌ Sequelize unique constraint error');

        // Log unique constraint error
        await logUserActivity(null, 'REGISTRATION_UNIQUE_CONSTRAINT_ERROR', {
          email: req.body.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          constraintField: error.errors?.[0]?.path
        });

        return res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: 'An account with this email already exists.'
        });
      }

      // Handle database connection errors
      if (error.name === 'SequelizeConnectionError') {
        console.log('❌ Database connection error');

        // Log database connection error
        await logUserActivity(null, 'REGISTRATION_DATABASE_CONNECTION_ERROR', {
          email: req.body.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/register', {
          title: 'Register',
          user: null,
          errorToast: 'Database connection failed. Please try again later.'
        });
      }

      res.render('users/register', {
        title: 'Register',
        user: null,
        errorToast: 'Something went wrong. Please try again.'
      });
    }
  },

  // POST /users/logout
  logout: async (req, res) => {
    console.log('🔍 Logout attempt for user:', req.session.user?.email);

    const user = req.session.user;

    try {
      // Log logout attempt
      if (user) {
        await logUserActivity(user.id, 'LOGOUT_SUCCESS', {
          userEmail: user.email,
          userName: user.name,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          sessionDuration: req.session.cookie.maxAge ? 'persistent' : 'session'
        });
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('Logout error:', err);

          // Log logout error
          if (user) {
            loggingService.logError(user.id, 'LOGOUT_ERROR', err, {
              userEmail: user.email,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            }).catch(console.error);
          }
        } else {
          console.log('✅ User logged out successfully');
        }
        res.redirect('/');
      });
    } catch (error) {
      console.error('Logout logging error:', error);
      // Continue with logout even if logging fails
      req.session.destroy((err) => {
        if (err) {
          console.error('Logout error:', err);
        }
        res.redirect('/');
      });
    }
  },

  ///htet

  // GET /users/forgot-password
  showForgotPassword: (req, res) => {
    res.render('users/forgot-password', {
      title: 'Forgot Password',
      user: req.session.user || null
    });
  },

  // POST /users/forgot-password
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.render('users/forgot-password', {
          title: 'Forgot Password',
          user: null,
          error: 'Email is required.'
        });
      }

      // Find user by email
      const user = await User.findByEmail(email);

      if (user) {
        // Check if user has Google OAuth linked (prioritize Google sign-in)
        if (user.googleId) {
          console.log('🔍 Password reset requested for user with Google OAuth linked:', email);
          console.log(`   Google ID: ${user.googleId}, Password: ${user.password ? 'SET' : 'NULL'}`);
          return res.render('users/forgot-password', {
            title: 'Forgot Password',
            user: null,
            error: 'This account is linked with Google Sign-In. Please click "Continue with Google" on the login page for the best experience.',
            isGoogleUser: true
          });
        }

        // Only proceed with password reset for users without Google OAuth
        if (!user.googleId && user.password) {
          // Generate password reset token for regular users
          const resetToken = user.generatePasswordResetToken();
          await user.save();

          console.log('🔍 Password reset requested for regular user:', email);
          console.log('🔑 Reset token generated:', resetToken);

          // Send password reset email
          const emailResult = await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);

          if (emailResult.success) {
            console.log('✅ Password reset email sent successfully to:', email);
          } else {
            console.log('❌ Failed to send password reset email:', emailResult.error);
            // Don't reveal if email failed to send for security reasons
          }
        }
      } else {
        console.log('🔍 Password reset requested for non-existent email:', email);
      }

      // Show success message for regular users (don't reveal if email exists or if sending failed)
      res.render('users/forgot-password', {
        title: 'Forgot Password',
        user: null,
        success: true
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.render('users/forgot-password', {
        title: 'Forgot Password',
        user: null,
        error: 'Something went wrong. Please try again.'
      });
    }
  },

  // GET /users/reset-password/:token
  showResetPassword: async (req, res) => {
    try {
      const { token } = req.params;

      // Find user by reset token
      const user = await User.findByResetToken(token);

      if (!user) {
        return res.render('users/reset-password', {
          title: 'Reset Password',
          user: null,
          error: 'Password reset token is invalid or has expired.',
          token: null
        });
      }

      res.render('users/reset-password', {
        title: 'Reset Password',
        user: null,
        token
      });
    } catch (error) {
      console.error('Show reset password error:', error);
      res.render('users/reset-password', {
        title: 'Reset Password',
        user: null,
        error: 'Something went wrong. Please try again.',
        token: null
      });
    }
  },

  // POST /users/reset-password/:token
  resetPassword: async (req, res) => {
    try {
      const { token } = req.params;
      const { password, confirmPassword } = req.body;

      if (!password || !confirmPassword) {
        return res.render('users/reset-password', {
          title: 'Reset Password',
          user: null,
          error: 'Password and confirm password are required.',
          token
        });
      }

      if (password !== confirmPassword) {
        return res.render('users/reset-password', {
          title: 'Reset Password',
          user: null,
          error: 'Passwords do not match.',
          token
        });
      }

      if (password.length < 6) {
        return res.render('users/reset-password', {
          title: 'Reset Password',
          user: null,
          error: 'Password must be at least 6 characters long.',
          token
        });
      }

      // Find user by reset token
      const user = await User.findByResetToken(token);

      if (!user) {
        return res.render('users/reset-password', {
          title: 'Reset Password',
          user: null,
          error: 'Password reset token is invalid or has expired.',
          token: null
        });
      }

      // Update password
      await User.updatePassword(user.id, password);

      res.render('users/login', {
        title: 'Login',
        user: null,
        success: 'Password reset successful! You can now login with your new password.'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.render('users/reset-password', {
        title: 'Reset Password',
        user: null,
        error: 'Something went wrong. Please try again.',
        token: req.params.token
      });
    }
  },

  // GET /users/verification-pending
  showVerificationPending: (req, res) => {
    const pendingData = req.session.pendingVerification;
    if (!pendingData) {
      return res.redirect('/users/login');
    }

    // Clear the session data after using it
    delete req.session.pendingVerification;

    res.render('users/verification-pending', {
      title: 'Email Verification Required',
      user: null,
      email: pendingData.email,
      name: pendingData.name,
      message: pendingData.message
    });
  },

  // GET /users/verify-email/:token
  verifyEmail: async (req, res) => {
    try {
      const { token } = req.params;
      console.log('🔍 Email verification attempt with token:', token);

      // Log verification attempt
      await logUserActivity(null, 'EMAIL_VERIFICATION_ATTEMPT', {
        token: token,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Find user by verification token
      const user = await User.findByVerificationToken(token);

      if (!user) {
        console.log('❌ Invalid or expired verification token');

        // Log invalid token attempt
        await logUserActivity(null, 'EMAIL_VERIFICATION_INVALID_TOKEN', {
          token: token,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.render('users/verification-result', {
          title: 'Email Verification',
          user: null,
          success: false,
          message: 'Invalid or expired verification link. Please request a new verification email.',
          showResendButton: true
        });
      }

      // Verify the email
      await User.verifyEmail(user.id);
      console.log('✅ Email verified successfully for user:', user.email);

      // Log successful verification
      await logUserActivity(user.id, 'EMAIL_VERIFICATION_SUCCESS', {
        userEmail: user.email,
        userName: user.name,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Send welcome email
      const welcomeResult = await emailService.sendWelcomeEmail(user.email, user.name);
      if (welcomeResult.success) {
        console.log('✅ Welcome email sent successfully');

        // Log welcome email sent
        await logUserActivity(user.id, 'WELCOME_EMAIL_SENT', {
          userEmail: user.email,
          userName: user.name,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } else {
        console.log('❌ Failed to send welcome email:', welcomeResult.error);

        // Log welcome email failure
        await loggingService.logError(user.id, 'WELCOME_EMAIL_FAILED', new Error(welcomeResult.error), {
          userEmail: user.email,
          userName: user.name,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      // Auto login the user after verification
      req.session.user = user.toJSON();
      req.session.user.email_verified = true; // Update session data

      res.render('users/verification-result', {
        title: 'Email Verification',
        user: req.session.user,
        success: true,
        message: 'Your email has been verified successfully! Welcome to ATOM Game Shop.',
        showContinueButton: true
      });

    } catch (error) {
      console.error('❌ Email verification error:', error);

      // Log verification error
      await loggingService.logError(null, 'EMAIL_VERIFICATION_ERROR', error, {
        token: req.params.token,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        errorMessage: error.message
      });

      res.render('users/verification-result', {
        title: 'Email Verification',
        user: null,
        success: false,
        message: 'Something went wrong during verification. Please try again.',
        showResendButton: true
      });
    }
  },

  // POST /users/resend-verification
  resendVerificationEmail: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Find user by email
      const user = await User.findByEmail(email);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.email_verified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      // Generate new verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      console.log('📧 Resending verification email to:', email);
      const emailResult = await emailService.sendVerificationEmail(email, user.name, verificationToken);

      if (emailResult.success) {
        console.log('✅ Verification email resent successfully');
        res.json({
          success: true,
          message: 'Verification email sent successfully!'
        });
      } else {
        console.log('❌ Failed to resend verification email:', emailResult.error);
        res.status(500).json({
          success: false,
          message: 'Failed to send verification email. Please try again later.'
        });
      }
    } catch (error) {
      console.error('❌ Resend verification email error:', error);
      res.status(500).json({
        success: false,
        message: 'Something went wrong. Please try again.'
      });
    }
  },

  // POST /users/update-profile - Update user profile
  updateProfile: async (req, res) => {
    try {
      console.log('🔍 Profile update attempt:', req.body);
      const { name, phone } = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      // Basic validation
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        });
      }

      if (name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Name must be at least 2 characters long'
        });
      }

      // Find and update user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update user information
      await user.update({
        name: name.trim(),
        phone_number: phone ? phone.trim() : null
      });

      // Update session data
      req.session.user.name = name.trim();
      req.session.user.phone_number = phone ? phone.trim() : null;

      console.log('✅ Profile updated successfully for user:', userId);
      res.json({
        success: true,
        message: 'Profile updated successfully!'
      });

    } catch (error) {
      console.error('❌ Profile update error:', error);
      res.status(500).json({
        success: false,
        message: 'Something went wrong. Please try again.'
      });
    }
  },

  // POST /users/change-password - Change user password
  changePassword: async (req, res) => {
    try {
      console.log('🔍 Password change attempt');
      const { currentPassword, newPassword, confirmNewPassword } = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      // Basic validation
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required',
          field: 'currentPassword'
        });
      }

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password is required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      if (!confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: 'Please confirm your new password'
        });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      // Find user and verify current password
      const user = await User.findByPk(userId, {
        attributes: ['id', 'name', 'email', 'password']
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check current password
      const isCurrentPasswordValid = await user.checkPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
          field: 'currentPassword'
        });
      }

      // Update password using the static method
      await User.updatePassword(userId, newPassword);

      console.log('✅ Password changed successfully for user:', userId);
      res.json({
        success: true,
        message: 'Password changed successfully!'
      });

    } catch (error) {
      console.error('❌ Password change error:', error);
      res.status(500).json({
        success: false,
        message: 'Something went wrong. Please try again.'
      });
    }
  }
};

module.exports = userController;