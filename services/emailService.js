const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Check if email credentials are provided
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('⚠️  Email service disabled: No SMTP credentials found in .env file');
      this.transporter = null;
      return;
    }

    // Try port 587 with authentication first (most reliable for domain email)
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      // Allow self-signed certificates
      requireTLS: false,
      ignoreTLS: false
    };

    this.transporter = nodemailer.createTransport(smtpConfig);

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        if (error.message.includes('zen.spamhaus.org') || error.message.includes('blocked')) {
          console.log('⚠️  Email service limited: IP is blacklisted by spam filters');
          console.log('   Your application will work normally, but emails will be limited');
          this.blacklisted = true;
        } else {
          console.log('❌ Email service configuration error:', error.message);
          console.log('   Attempting alternative configuration...');

          // Try alternative configuration without auth for port 25
          if (process.env.SMTP_HOST === 'box.atomgameshop.com') {
            const altConfig = {
              host: process.env.SMTP_HOST,
              port: 25,
              secure: false,
              tls: {
                rejectUnauthorized: false
              }
            };

            this.transporter = nodemailer.createTransport(altConfig);
            console.log('🔄 Trying port 25 without authentication...');
          }
        }
      } else {
        console.log('✅ Email service is ready to send messages');
        this.blacklisted = false;
      }
    });
  }

  // Send transaction approval email
  async sendApprovalEmail(userEmail, userName, transaction) {
    try {
      // Check if email service is available
      if (!this.transporter) {
        console.log('⚠️ Email service not configured - approval email not sent');
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '✅ Top-up Request Approved - ATOM Game Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px;">⚡ ATOM Game Shop</h1>
              <p style="color: #d4edda; margin: 15px 0 0 0; font-size: 18px;">Top-up Request Approved</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="background: #28a745; color: white; padding: 20px; border-radius: 50px; display: inline-block; margin-bottom: 25px;">
                  <span style="font-size: 32px;">✅</span>
                </div>
                <h2 style="color: #28a745; margin: 0 0 15px 0; font-size: 28px;">Payment Approved!</h2>
                <p style="color: #6c757d; margin: 0; font-size: 16px;">Hi <strong>${userName}</strong>! Your wallet has been credited successfully</p>
              </div>

              <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 20px 0; color: #495057; font-size: 20px;">💰 Transaction Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Transaction ID:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">#${transaction.id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Amount Credited:</td>
                    <td style="padding: 12px 0; color: #28a745; font-weight: 700; font-size: 20px; border-bottom: 1px solid #e9ecef;">${parseFloat(transaction.amount).toLocaleString()} ${transaction.currency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Payment Method:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">${transaction.payment_type}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Processed Date:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500;">Approved By:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600;">${transaction.updated_by || 'Admin'}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h4 style="margin: 0 0 10px 0; color: #155724; font-size: 16px;">🎉 What's Next?</h4>
                <p style="margin: 0; color: #155724; font-size: 14px; line-height: 1.5;">
                  Your wallet balance has been updated! You can now use your funds to purchase ML diamonds and other game items.
                </p>
              </div>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/wallet" 
                   style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);">
                  💰 View My Wallet
                </a>
              </div>

              <div style="text-align: center; margin-bottom: 25px;">
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/shop" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; margin: 0 10px;">
                  🛒 Shop Now
                </a>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 25px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                  Thank you for choosing ATOM Game Shop!<br>
                  If you have any questions, please contact our support team.
                </p>
              </div>
            </div>
          </div>
        `
      };

      console.log(`📧 Sending approval email to ${userEmail} for transaction #${transaction.id}`);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Approval email sent successfully to ${userEmail}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send approval email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send transaction rejection email
  async sendRejectionEmail(userEmail, userName, transaction, reason) {
    try {
      // Check if email service is available
      if (!this.transporter) {
        console.log('⚠️ Email service not configured - rejection email not sent');
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '❌ Top-up Request Rejected - ATOM Game Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px;">⚡ ATOM Game Shop</h1>
              <p style="color: #f8d7da; margin: 15px 0 0 0; font-size: 18px;">Top-up Request Status</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="background: #dc3545; color: white; padding: 20px; border-radius: 50px; display: inline-block; margin-bottom: 25px;">
                  <span style="font-size: 32px;">❌</span>
                </div>
                <h2 style="color: #dc3545; margin: 0 0 15px 0; font-size: 28px;">Payment Rejected</h2>
                <p style="color: #6c757d; margin: 0; font-size: 16px;">Hi <strong>${userName}</strong>! We're sorry, but your top-up request could not be processed</p>
              </div>

              <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 20px 0; color: #495057; font-size: 20px;">📋 Transaction Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Transaction ID:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">#${transaction.id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Amount:</td>
                    <td style="padding: 12px 0; color: #dc3545; font-weight: 700; font-size: 20px; border-bottom: 1px solid #e9ecef;">${parseFloat(transaction.amount).toLocaleString()} ${transaction.currency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Payment Method:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">${transaction.payment_type}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Processed Date:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500;">Reviewed By:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600;">${transaction.updated_by || 'Admin'}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h4 style="margin: 0 0 15px 0; color: #856404; font-size: 18px;">⚠️ Reason for Rejection:</h4>
                <p style="margin: 0; color: #856404; font-weight: 500; font-size: 16px; line-height: 1.5;">${reason}</p>
              </div>

              <div style="background: #e2e3e5; border: 1px solid #d6d8db; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h4 style="margin: 0 0 10px 0; color: #383d41; font-size: 16px;">💡 What You Can Do Next:</h4>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #383d41; font-size: 14px; line-height: 1.5;">
                  <li>Check your payment information and try again</li>
                  <li>Ensure your screenshot clearly shows the payment details</li>
                  <li>Make sure the payment amount matches your request</li>
                  <li>Contact our support team if you need assistance</li>
                </ul>
              </div>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/wallet" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                  🔄 Try Again
                </a>
              </div>

              <div style="text-align: center; margin-bottom: 25px;">
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/contact" 
                   style="background: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; margin: 0 10px;">
                  💬 Contact Support
                </a>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 25px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                  Please ensure your payment information is correct and try again.<br>
                  If you need assistance, please contact our support team at ATOM Game Shop.
                </p>
              </div>
            </div>
          </div>
        `
      };

      console.log(`📧 Sending rejection email to ${userEmail} for transaction #${transaction.id} - Reason: ${reason}`);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Rejection email sent successfully to ${userEmail}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send rejection email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send top-up approval email (for Telegram integration)
  async sendTopUpApprovalEmail(userEmail, userName, amount, currency, transactionId) {
    try {
      if (!this.transporter) {
        console.log('⚠️ Email service not configured - top-up approval email not sent');
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '✅ Wallet Top-up Approved - ATOM Game Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px;">⚡ ATOM Game Shop</h1>
              <p style="color: #d4edda; margin: 15px 0 0 0; font-size: 18px;">Wallet Top-up Approved</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="background: #28a745; color: white; padding: 20px; border-radius: 50px; display: inline-block; margin-bottom: 25px;">
                  <span style="font-size: 32px;">✅</span>
                </div>
                <h2 style="color: #28a745; margin: 0 0 15px 0; font-size: 28px;">Top-up Successful!</h2>
                <p style="color: #6c757d; margin: 0; font-size: 16px;">Hi <strong>${userName}</strong>! Your wallet has been credited successfully</p>
              </div>

              <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 20px 0; color: #495057; font-size: 20px;">💰 Transaction Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Transaction ID:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">#${transactionId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Amount Credited:</td>
                    <td style="padding: 12px 0; color: #28a745; font-weight: 700; font-size: 20px; border-bottom: 1px solid #e9ecef;">${parseFloat(amount).toLocaleString()} ${currency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Processed Date:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500;">Status:</td>
                    <td style="padding: 12px 0; color: #28a745; font-weight: 600;">Approved by Admin</td>
                  </tr>
                </table>
              </div>

              <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h4 style="margin: 0 0 10px 0; color: #155724; font-size: 16px;">🎉 What's Next?</h4>
                <p style="margin: 0; color: #155724; font-size: 14px; line-height: 1.5;">
                  Your wallet balance has been updated! You can now use your funds to purchase ML diamonds and other game items.
                </p>
              </div>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}/wallet" 
                   style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);">
                  💰 View My Wallet
                </a>
              </div>

              <div style="text-align: center; margin-bottom: 25px;">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}/shop" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; margin: 0 10px;">
                  🛒 Shop Now
                </a>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 25px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                  Thank you for choosing ATOM Game Shop!<br>
                  If you have any questions, please contact our support team.
                </p>
              </div>
            </div>
          </div>
        `
      };

      console.log(`📧 Sending top-up approval email to ${userEmail} for transaction #${transactionId}`);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Top-up approval email sent successfully to ${userEmail}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send top-up approval email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send top-up rejection email (for Telegram integration)
  async sendTopUpRejectionEmail(userEmail, userName, amount, currency, reason, transactionId) {
    try {
      if (!this.transporter) {
        console.log('⚠️ Email service not configured - top-up rejection email not sent');
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '❌ Wallet Top-up Rejected - ATOM Game Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px;">⚡ ATOM Game Shop</h1>
              <p style="color: #f8d7da; margin: 15px 0 0 0; font-size: 18px;">Wallet Top-up Status</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="background: #dc3545; color: white; padding: 20px; border-radius: 50px; display: inline-block; margin-bottom: 25px;">
                  <span style="font-size: 32px;">❌</span>
                </div>
                <h2 style="color: #dc3545; margin: 0 0 15px 0; font-size: 28px;">Top-up Rejected</h2>
                <p style="color: #6c757d; margin: 0; font-size: 16px;">Hi <strong>${userName}</strong>! Unfortunately, your top-up request could not be processed</p>
              </div>

              <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 20px 0; color: #495057; font-size: 20px;">📋 Transaction Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Transaction ID:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">#${transactionId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Amount:</td>
                    <td style="padding: 12px 0; color: #dc3545; font-weight: 700; font-size: 20px; border-bottom: 1px solid #e9ecef;">${parseFloat(amount).toLocaleString()} ${currency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500; border-bottom: 1px solid #e9ecef;">Processed Date:</td>
                    <td style="padding: 12px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6c757d; font-weight: 500;">Reason:</td>
                    <td style="padding: 12px 0; color: #dc3545; font-weight: 600;">${reason}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h4 style="margin: 0 0 10px 0; color: #721c24; font-size: 16px;">🔍 What to do next?</h4>
                <p style="margin: 0; color: #721c24; font-size: 14px; line-height: 1.5;">
                  Please review the rejection reason above and submit a new top-up request with the correct information. If you have questions, contact our support team.
                </p>
              </div>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}/wallet" 
                   style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(220, 53, 69, 0.3);">
                  💰 Try Again
                </a>
              </div>

              <div style="text-align: center; margin-bottom: 25px;">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}/contact" 
                   style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; margin: 0 10px;">
                  📞 Contact Support
                </a>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 25px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                  Thank you for choosing ATOM Game Shop!<br>
                  We're here to help if you need assistance.
                </p>
              </div>
            </div>
          </div>
        `
      };

      console.log(`📧 Sending top-up rejection email to ${userEmail} for transaction #${transactionId}`);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Top-up rejection email sent successfully to ${userEmail}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send top-up rejection email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(userEmail, userName, resetToken) {
    try {
      // Check if email service is available
      if (!this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      const resetURL = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/users/reset-password/${resetToken}`;

      const mailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '🔒 Password Reset Request - ATOM Game Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px;">⚡ ATOM Game Shop</h1>
              <p style="color: #e8eaed; margin: 15px 0 0 0; font-size: 18px;">Password Reset Request</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="background: #ff6b6b; color: white; padding: 20px; border-radius: 50px; display: inline-block; margin-bottom: 25px;">
                  <span style="font-size: 32px;">🔒</span>
                </div>
                <h2 style="color: #333; margin: 0 0 15px 0; font-size: 28px;">Reset Your Password</h2>
                <p style="color: #6c757d; margin: 0; font-size: 16px; line-height: 1.5;">
                  Hi <strong>${userName}</strong>! We received a request to reset your password for your ATOM Game Shop account.
                </p>
              </div>

              <div style="text-align: center; margin: 35px 0;">
                <a href="${resetURL}" 
                   style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3); transition: all 0.3s ease;">
                  🔒 Reset My Password
                </a>
              </div>

              <div style="background: #e8f4fd; border: 1px solid #b3e5fc; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h4 style="margin: 0 0 10px 0; color: #0277bd; font-size: 16px;">🔐 What happens next?</h4>
                <ul style="margin: 0; padding-left: 20px; color: #0277bd;">
                  <li style="margin-bottom: 8px;">Click the reset button above</li>
                  <li style="margin-bottom: 8px;">Create a new secure password</li>
                  <li style="margin-bottom: 8px;">Log in with your new password</li>
                  <li>Continue shopping for ML diamonds!</li>
                </ul>
              </div>

              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 25px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px; text-align: center;">
                  ⏰ <strong>This link expires in 10 minutes</strong> for your security
                </p>
              </div>

              <div style="text-align: center; margin: 25px 0;">
                <p style="color: #6c757d; margin: 0; font-size: 14px;">
                  Can't see the button? Copy and paste this link into your browser:<br>
                  <a href="${resetURL}" style="color: #667eea; word-break: break-all;">${resetURL}</a>
                </p>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 25px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                  If you didn't request this password reset, you can safely ignore this email.<br>
                  Need help? Contact our support team at <a href="mailto:support@atomgameshop.com" style="color: #667eea;">support@atomgameshop.com</a>
                </p>
              </div>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${userEmail}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send email verification email
  async sendVerificationEmail(userEmail, userName, verificationToken) {
    try {
      // Check if email service is available
      if (!this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      const verificationUrl = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/users/verify-email/${verificationToken}`;

      const mailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '🔒 Please verify your email - ATOM Game Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px;">⚡ ATOM Game Shop</h1>
              <p style="color: #e8eaed; margin: 15px 0 0 0; font-size: 18px;">Welcome aboard!</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="background: #28a745; color: white; padding: 20px; border-radius: 50px; display: inline-block; margin-bottom: 25px;">
                  <span style="font-size: 32px;">📧</span>
                </div>
                <h2 style="color: #333; margin: 0 0 15px 0; font-size: 28px;">Verify Your Email</h2>
                <p style="color: #6c757d; margin: 0; font-size: 16px; line-height: 1.5;">
                  Hi <strong>${userName}</strong>! Please verify your email address to complete your registration and start shopping for ML diamonds.
                </p>
              </div>

              <div style="text-align: center; margin: 35px 0;">
                <a href="${verificationUrl}" 
                   style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3); transition: all 0.3s ease;">
                  ✅ Verify My Email
                </a>
              </div>

              <div style="background: #e8f4fd; border: 1px solid #b3e5fc; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h4 style="margin: 0 0 10px 0; color: #0277bd; font-size: 16px;">📱 What happens next?</h4>
                <ul style="margin: 0; padding-left: 20px; color: #0277bd;">
                  <li style="margin-bottom: 8px;">Click the verification button above</li>
                  <li style="margin-bottom: 8px;">Your email will be confirmed instantly</li>
                  <li style="margin-bottom: 8px;">Start shopping for ML diamonds right away!</li>
                  <li>Enjoy exclusive offers and faster checkout</li>
                </ul>
              </div>

              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 25px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px; text-align: center;">
                  ⏰ <strong>This link expires in 24 hours</strong> for your security
                </p>
              </div>

              <div style="text-align: center; margin: 25px 0;">
                <p style="color: #6c757d; margin: 0; font-size: 14px;">
                  Can't see the button? Copy and paste this link into your browser:<br>
                  <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
                </p>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 25px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                  If you didn't create an account with ATOM Game Shop, you can safely ignore this email.<br>
                  Need help? Contact our support team at <a href="mailto:support@atomgameshop.com" style="color: #667eea;">support@atomgameshop.com</a>
                </p>
              </div>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${userEmail}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send welcome email after verification
  async sendWelcomeEmail(userEmail, userName) {
    try {
      // Check if email service is available
      if (!this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '🎉 Welcome to ATOM Game Shop - Your account is ready!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px;">⚡ ATOM Game Shop</h1>
              <p style="color: #e8eaed; margin: 15px 0 0 0; font-size: 18px;">Account Verified Successfully!</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="background: #28a745; color: white; padding: 20px; border-radius: 50px; display: inline-block; margin-bottom: 25px;">
                  <span style="font-size: 32px;">🎉</span>
                </div>
                <h2 style="color: #28a745; margin: 0 0 15px 0; font-size: 28px;">Welcome, ${userName}!</h2>
                <p style="color: #6c757d; margin: 0; font-size: 16px; line-height: 1.5;">
                  Your email has been verified and your account is now active. You're all set to start shopping for ML diamonds!
                </p>
              </div>

              <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; color: #495057; text-align: center;">🚀 What you can do now:</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                  <div style="text-align: center; padding: 15px;">
                    <span style="font-size: 24px; margin-bottom: 10px; display: block;">💎</span>
                    <strong style="color: #495057;">Buy ML Diamonds</strong>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">Browse our packages</p>
                  </div>
                  <div style="text-align: center; padding: 15px;">
                    <span style="font-size: 24px; margin-bottom: 10px; display: block;">💰</span>
                    <strong style="color: #495057;">Top Up Wallet</strong>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">Add funds securely</p>
                  </div>
                  <div style="text-align: center; padding: 15px;">
                    <span style="font-size: 24px; margin-bottom: 10px; display: block;">🎁</span>
                    <strong style="color: #495057;">Special Offers</strong>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">Exclusive deals</p>
                  </div>
                  <div style="text-align: center; padding: 15px;">
                    <span style="font-size: 24px; margin-bottom: 10px; display: block;">⚡</span>
                    <strong style="color: #495057;">Fast Delivery</strong>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">Instant delivery</p>
                  </div>
                </div>
              </div>

              <div style="text-align: center; margin: 35px 0;">
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/shop" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); margin-right: 15px;">
                  🛒 Start Shopping
                </a>
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/wallet" 
                   style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);">
                  💰 My Wallet
                </a>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 25px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                  Thank you for choosing ATOM Game Shop!<br>
                  Follow us on social media for the latest updates and exclusive offers.
                </p>
              </div>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${userEmail}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send purchase confirmation email
  async sendPurchaseConfirmationEmail(userEmail, userName, purchase, newWalletBalance) {
    try {
      // Check if email service is available
      if (!this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: `"ML Diamonds Store" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '💎 Purchase Confirmation - ML Diamonds Delivered',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">💎 ML Diamonds Store</h1>
              <p style="color: #e8eaed; margin: 10px 0 0 0; font-size: 16px;">Purchase Confirmation</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="background: #28a745; color: white; padding: 15px; border-radius: 50px; display: inline-block; margin-bottom: 20px;">
                  <span style="font-size: 24px;">💎</span>
                </div>
                <h2 style="color: #28a745; margin: 0; font-size: 24px;">Purchase Successful!</h2>
                <p style="color: #6c757d; margin: 10px 0 0 0;">Your Mobile Legends diamonds have been processed</p>
              </div>

              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 15px 0; color: #495057;">Purchase Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Purchase ID:</td>
                    <td style="padding: 8px 0; color: #495057; font-weight: 600;">#${purchase.id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Package:</td>
                    <td style="padding: 8px 0; color: #495057; font-weight: 600;">${purchase.product_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Amount:</td>
                    <td style="padding: 8px 0; color: #28a745; font-weight: 700; font-size: 18px;">${parseFloat(purchase.total_price).toLocaleString()} ${purchase.currency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Purchase Date:</td>
                    <td style="padding: 8px 0; color: #495057; font-weight: 600;">${new Date(purchase.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 15px 0; color: #495057;">Mobile Legends Account</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">User ID:</td>
                    <td style="padding: 8px 0; color: #495057; font-weight: 600;">${purchase.ml_user_id || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Zone ID:</td>
                    <td style="padding: 8px 0; color: #495057; font-weight: 600;">${purchase.ml_zone_id || 'N/A'}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 15px 0; color: #495057;">Wallet Update</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Previous Balance:</td>
                    <td style="padding: 8px 0; color: #495057; font-weight: 600;">${(parseFloat(newWalletBalance || 0) + parseFloat(purchase.total_price || 0)).toLocaleString()} ${purchase.currency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Amount Deducted:</td>
                    <td style="padding: 8px 0; color: #dc3545; font-weight: 600;">-${parseFloat(purchase.total_price || 0).toLocaleString()} ${purchase.currency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Current Balance:</td>
                    <td style="padding: 8px 0; color: #28a745; font-weight: 700; font-size: 18px;">${parseFloat(newWalletBalance || 0).toLocaleString()} ${purchase.currency}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin-bottom: 25px;">
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/ml/shop" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; margin-right: 10px;">
                  Shop More
                </a>
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/wallet" 
                   style="background: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
                  View Wallet
                </a>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 20px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px;">
                  Thank you for choosing ML Diamonds Store!<br>
                  Your diamonds should appear in your ML account shortly.
                </p>
              </div>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Purchase confirmation email sent to ${userEmail}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send purchase confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendGameOrderStatusEmail(userEmail, userName, order, walletAfter) {
    try {
      if (!this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      const status = String(order?.status || '').toUpperCase();
      const statusLabel = status || 'PENDING';
      const gameCode = String(order?.game_code || '').toUpperCase();
      const productName = String(order?.product_name || '');
      const amount = Number(order?.total_price || 0);
      const currency = String(order?.currency || 'MMK');
      const orderId = order?.order_id ? String(order.order_id) : '';
      const playerId = order?.player_id ? String(order.player_id) : '';
      const serverId = order?.server_id ? String(order.server_id) : '';
      const playerName = order?.player_name ? String(order.player_name) : '';
      const createdAt = order?.createdAt ? new Date(order.createdAt) : new Date();

      const subjectPrefix = gameCode ? `[${gameCode}] ` : '';
      const mailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `${subjectPrefix}Order Status: ${statusLabel}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #111827 0%, #374151 100%); padding: 28px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">ATOM Game Shop</h1>
              <p style="color: #e5e7eb; margin: 10px 0 0 0; font-size: 14px;">Game Order Update</p>
            </div>

            <div style="background: white; padding: 28px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="margin: 0 0 18px 0; color: #111827; font-size: 16px;">Hi ${userName || ''},</p>
              <div style="background: #f3f4f6; padding: 14px 16px; border-radius: 8px; margin-bottom: 18px;">
                <p style="margin: 0; color: #111827; font-weight: 700;">Status: ${statusLabel}</p>
              </div>

              <div style="background: #f8fafc; padding: 18px; border-radius: 8px; margin-bottom: 18px;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px;">Order Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Order ID:</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: 600;">${orderId || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Product:</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: 600;">${productName || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Amount:</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: 700;">${amount.toLocaleString()} ${currency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Time:</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: 600;">${createdAt.toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #eff6ff; padding: 18px; border-radius: 8px; margin-bottom: 18px;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px;">Game Account</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Player ID:</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: 600;">${playerId || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Server ID:</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: 600;">${serverId || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Player Name:</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: 600;">${playerName || 'N/A'}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #ecfdf5; padding: 18px; border-radius: 8px; margin-bottom: 18px;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px;">Wallet</h3>
                <p style="margin: 0; color: #111827; font-weight: 600;">Current Balance: ${(Number(walletAfter || 0)).toLocaleString()} ${currency}</p>
              </div>

              <div style="text-align: center; margin-top: 22px;">
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/shop/${gameCode ? gameCode.toLowerCase() : ''}"
                   style="background: linear-gradient(135deg, #111827 0%, #374151 100%); color: white; padding: 12px 26px; text-decoration: none; border-radius: 24px; font-weight: 700; display: inline-block;">
                  View Shop
                </a>
              </div>

              <div style="border-top: 2px solid #e5e7eb; padding-top: 18px; text-align: center; margin-top: 22px;">
                <p style="color: #6b7280; margin: 0; font-size: 13px; line-height: 1.5;">
                  If you did not place this order, please contact support.
                </p>
              </div>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send contact form email to admin
  async sendContactEmail(contactData) {
    try {
      // Check if email service is available
      if (!this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      const { name, email, phone, subject, message } = contactData;
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

      if (!adminEmail) {
        console.log('⚠️ No admin email configured, contact form will only send confirmation to user');
      } else {
        console.log(`📧 Sending contact form to admin: ${adminEmail}`);
      }

      // Confirmation email to user
      const userMailOptions = {
        from: `"ATOM Game Shop" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '✅ We received your message - ATOM Game Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">✅ Message Received</h1>
              <p style="color: #e8eaed; margin: 10px 0 0 0; font-size: 16px;">Thank you for contacting us!</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="background: #28a745; color: white; padding: 15px; border-radius: 50px; display: inline-block; margin-bottom: 20px;">
                  <span style="font-size: 24px;">📧</span>
                </div>
                <h2 style="color: #28a745; margin: 0; font-size: 24px;">Hi ${name}!</h2>
                <p style="color: #6c757d; margin: 10px 0 0 0; line-height: 1.5;">We've received your message and our team will get back to you as soon as possible.</p>
              </div>

              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 15px 0; color: #495057;">Your Message Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500; width: 30%;">Subject:</td>
                    <td style="padding: 8px 0; color: #495057; font-weight: 600;">${subject}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Sent:</td>
                    <td style="padding: 8px 0; color: #495057; font-weight: 600;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
                <h3 style="margin: 0 0 15px 0; color: #495057;">⏱️ Response Time</h3>
                <p style="color: #28a745; margin: 0; font-size: 18px; font-weight: 600;">We typically respond within 1-2 hours</p>
                <p style="color: #6c757d; margin: 5px 0 0 0; font-size: 14px;">During business hours: 9 AM - 10 PM (GMT+6:30)</p>
              </div>

              <div style="text-align: center; margin-bottom: 25px;">
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/shop" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; margin-right: 10px;">
                  🛒 Continue Shopping
                </a>
                <a href="${process.env.WEBSITE_URL || 'http://localhost:3000'}/faq" 
                   style="background: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
                  📖 View FAQ
                </a>
              </div>

              <div style="border-top: 2px solid #e9ecef; padding-top: 20px; text-align: center;">
                <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                  Need immediate assistance? Join our Telegram channel for live support!<br>
                  <a href="https://t.me/atomgameshop" style="color: #667eea;">@atomgameshop</a>
                </p>
              </div>
            </div>
          </div>
        `
      };

      // Send emails
      let adminResult = null;
      let userResult = null;

      // Send admin email if admin email is configured
      if (adminEmail) {
        const adminMailOptions = {
          from: `"ATOM Game Shop Contact Form" <${process.env.SMTP_USER}>`,
          to: adminEmail,
          replyTo: email,
          subject: `📧 Contact Form: ${subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">📧 Contact Form Message</h1>
                <p style="color: #e8eaed; margin: 10px 0 0 0; font-size: 16px;">New message from website visitor</p>
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                  <h3 style="margin: 0 0 15px 0; color: #495057;">Contact Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6c757d; font-weight: 500; width: 30%;">Name:</td>
                      <td style="padding: 8px 0; color: #495057; font-weight: 600;">${name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Email:</td>
                      <td style="padding: 8px 0; color: #495057; font-weight: 600;"><a href="mailto:${email}" style="color: #667eea;">${email}</a></td>
                    </tr>
                    ${phone ? `
                    <tr>
                      <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Phone:</td>
                      <td style="padding: 8px 0; color: #495057; font-weight: 600;">${phone}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Subject:</td>
                      <td style="padding: 8px 0; color: #495057; font-weight: 600;">${subject}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Date:</td>
                      <td style="padding: 8px 0; color: #495057; font-weight: 600;">${new Date().toLocaleString()}</td>
                    </tr>
                  </table>
                </div>

                <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                  <h3 style="margin: 0 0 15px 0; color: #495057;">Message</h3>
                  <div style="color: #495057; line-height: 1.6; white-space: pre-wrap;">${message}</div>
                </div>

                <div style="text-align: center; margin-bottom: 25px;">
                  <a href="mailto:${email}?subject=Re: ${subject}" 
                     style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
                    📧 Reply to ${name}
                  </a>
                </div>

                <div style="border-top: 2px solid #e9ecef; padding-top: 20px; text-align: center;">
                  <p style="color: #6c757d; margin: 0; font-size: 14px;">
                    This message was sent from the ATOM Game Shop contact form.<br>
                    Please respond promptly to maintain excellent customer service.
                  </p>
                </div>
              </div>
            </div>
          `
        };

        adminResult = await this.transporter.sendMail(adminMailOptions);
        console.log(`📧 Contact form email sent to admin (${adminEmail}):`, adminResult.messageId);
      }

      // Always send user confirmation email
      userResult = await this.transporter.sendMail(userMailOptions);
      console.log(`✅ Contact confirmation email sent to ${email}:`, userResult.messageId);

      return {
        success: true,
        adminMessageId: adminResult ? adminResult.messageId : null,
        userMessageId: userResult.messageId
      };
    } catch (error) {
      console.error('❌ Failed to send contact form emails:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
module.exports = emailService; 
