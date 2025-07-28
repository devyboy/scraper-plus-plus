const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async initialize() {
    try {
      const emailUser = process.env.EMAIL_USER;
      const emailPassword = process.env.EMAIL_APP_PASSWORD;

      if (!emailUser || !emailPassword) {
        throw new Error(
          "Email credentials not found. Please set EMAIL_USER and EMAIL_APP_PASSWORD in your environment variables."
        );
      }

      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      // Verify connection
      await this.transporter.verify();
      console.log("\t✅ Email service initialized successfully");
    } catch (error) {
      console.error("\t❌ Email service initialization failed:", error.message);
      throw error;
    }
  }

  async sendNewListingsNotification(userEmail, jobData, newListingsCount) {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      const subject = `🏠 New Redfin Listings Found - ${newListingsCount} new results`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
            New Property Listings Found in Redfin
          </h2>
          
          <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-top: 0;">📊 Summary</h3>
            <p><strong>New Listings:</strong> ${newListingsCount}</p>
            <p><strong>Search URL:</strong> <a href="${
              jobData.redfin_url
            }" style="color: #3498db;">View on Redfin</a></p>
            <p><strong>Spreadsheet:</strong> <a href="${
              jobData.sheet_url
            }" style="color: #3498db;">View Results</a></p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #7f8c8d;">
              Your property tracker found ${newListingsCount} new listings that match your search criteria. 
              Click the links above to view the details on Redfin or see all results in your Google Sheet.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #bdc3c7;">
            <p style="color: #95a5a6; font-size: 12px;">
              This is an automated notification from your Redfin Property Tracker. Please do not reply to this email.
              <br>Next check: ${new Date(
                Date.now() + 30 * 60 * 1000
              ).toLocaleString()}
            </p>
          </div>
        </div>
      `;

      const textContent = `
New Property Listings Found

Summary:
- New Listings: ${newListingsCount}
- Search URL: ${jobData.redfin_url}
- Spreadsheet: ${spreadsheetUrl}

Your property tracker found ${newListingsCount} new listings that match your search criteria. 
Visit the links above to view the details.

Next check: ${new Date(Date.now() + 30 * 60 * 1000).toLocaleString()}

This is an automated notification from your Redfin Property Tracker.
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`   📧 Email notification sent to ${userEmail}`);
      return result;
    } catch (error) {
      console.error(
        `   ❌ Failed to send email notification: ${error.message}`
      );
      throw error;
    }
  }

  async sendErrorNotification(userEmail, jobData, errorMessage) {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      const subject = `⚠️ Property Tracker Error - Job Failed`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
            ⚠️ Property Tracker Error
          </h2>
          
          <div style="background-color: #fdf2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <h3 style="color: #c0392b; margin-top: 0;">❌ Job Failed</h3>
            <p><strong>Error:</strong> ${errorMessage}</p>
            <p><strong>Search URL:</strong> <a href="${
              jobData.redfin_url
            }" style="color: #3498db;">View on Redfin</a></p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #7f8c8d;">
              Your property tracker encountered an error while processing your search. 
              The system will retry automatically on the next scheduled run.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #bdc3c7;">
            <p style="color: #95a5a6; font-size: 12px;">
              This is an automated notification from your Redfin Property Tracker.
              <br>Next check: ${new Date(
                Date.now() + 30 * 60 * 1000
              ).toLocaleString()}
            </p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: subject,
        html: htmlContent,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`   📧 Error notification sent to ${userEmail}`);
      return result;
    } catch (error) {
      console.error(
        `   ❌ Failed to send error notification: ${error.message}`
      );
      throw error;
    }
  }
}

module.exports = EmailService;
