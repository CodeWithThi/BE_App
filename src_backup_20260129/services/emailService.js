// src/services/emailService.js
import nodemailer from "nodemailer";

// ==========================================
// SMTP Configuration (đọc từ .env)
// ==========================================
// SMTP_HOST=smtp.gmail.com
// SMTP_PORT=587
// SMTP_SECURE=false (true for port 465)
// SMTP_USER=your-email@gmail.com
// SMTP_PASS=app-password-16-chars
// ==========================================

// Create transporter with SMTP settings from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

// Rate limit tracking (reset daily)
let emailsSentToday = 0;
let lastResetDate = new Date().toDateString();
const DAILY_LIMIT = parseInt(process.env.EMAIL_DAILY_LIMIT || "500");
const WARNING_THRESHOLD = 0.8; // Warn at 80% of limit

const emailService = {
  /**
   * Get current email usage stats
   * @returns {Object} - { sent, limit, remaining, warningLevel }
   */
  getUsageStats: () => {
    // Reset counter if new day
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      emailsSentToday = 0;
      lastResetDate = today;
    }

    const remaining = DAILY_LIMIT - emailsSentToday;
    const usagePercent = emailsSentToday / DAILY_LIMIT;

    return {
      sent: emailsSentToday,
      limit: DAILY_LIMIT,
      remaining,
      warningLevel: usagePercent >= WARNING_THRESHOLD ? "high" : usagePercent >= 0.5 ? "medium" : "low",
    };
  },

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} resetToken - Password reset token
   * @param {string} userName - User's name for personalization
   * @returns {Promise<{success: boolean, message: string}>}
   */
  sendPasswordResetEmail: async (to, resetToken, userName) => {
    // Check rate limit
    const stats = emailService.getUsageStats();
    if (stats.remaining <= 0) {
      console.error(`❌ Email rate limit exceeded! Sent: ${stats.sent}/${stats.limit}`);
      return {
        success: false,
        message: "Đã vượt giới hạn gửi email trong ngày. Vui lòng thử lại vào ngày mai."
      };
    }

    // Warn if approaching limit
    if (stats.warningLevel === "high") {
      console.warn(`⚠️ WARNING: Approaching email limit! ${stats.sent}/${stats.limit} (${stats.remaining} remaining)`);
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(to)}`;

    const mailOptions = {
      from: `"Trung Tâm Dạy Học" <${process.env.SMTP_USER || "noreply@trungtam.edu.vn"}>`,
      to,
      subject: "Đặt lại mật khẩu - Trung Tâm Dạy Học",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2563eb; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .button:hover { background: #1d4ed8; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px; }
            .link-fallback { word-break: break-all; font-size: 11px; color: #666; background: #e2e8f0; padding: 8px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Trung Tâm Dạy Học</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Hệ thống quản lý công việc</p>
            </div>
            <div class="content">
              <h2 style="color: #1e40af;">Xin chào ${userName || "bạn"}!</h2>
              <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
              <p>Nhấn vào nút bên dưới để đặt lại mật khẩu:</p>
              <p style="text-align: center;">
                <a href="${resetLink}" class="button" style="color: white;">🔐 Đặt lại mật khẩu</a>
              </p>
              <div class="warning">
                <strong>⚠️ Lưu ý quan trọng:</strong><br>
                • Link này sẽ <strong>hết hạn sau 1 giờ</strong><br>
                • Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này<br>
                • Không chia sẻ link này với bất kỳ ai
              </div>
              <p>Nếu nút không hoạt động, sao chép đường link sau vào trình duyệt:</p>
              <p class="link-fallback">${resetLink}</p>
            </div>
            <div class="footer">
              <p><strong>© 2025 Trung Tâm Dạy Học</strong></p>
              <p>Địa chỉ: Cao Đẳng Kỹ Thuật Đồng Nai</p>
              <p style="color: #999; font-size: 10px;">Email này được gửi tự động, vui lòng không trả lời.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Xin chào ${userName || "bạn"}!

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.

Truy cập link sau để đặt lại mật khẩu:
${resetLink}

⚠️ LƯU Ý:
• Link này sẽ hết hạn sau 1 giờ
• Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này
• Không chia sẻ link này với bất kỳ ai

---
© 2025 Trung Tâm Dạy Học
Địa chỉ: Cao Đẳng Kỹ Thuật Đồng Nai
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      emailsSentToday++; // Increment counter
      console.log(`✅ Password reset email sent to: ${to} (${emailsSentToday}/${DAILY_LIMIT} today)`);
      return { success: true, message: "Email đã được gửi thành công" };
    } catch (error) {
      console.error("❌ Error sending password reset email:", error.message);

      // Provide helpful error messages
      let userMessage = "Không thể gửi email. Vui lòng thử lại sau.";

      if (error.code === "EAUTH") {
        userMessage = "Lỗi xác thực SMTP. Kiểm tra SMTP_USER và SMTP_PASS trong .env";
        console.error("→ Hint: Đảm bảo đã dùng App Password, không phải mật khẩu thường");
      } else if (error.code === "ECONNREFUSED") {
        userMessage = "Không thể kết nối SMTP server. Kiểm tra SMTP_HOST và SMTP_PORT";
      } else if (error.responseCode === 550) {
        userMessage = "Email không tồn tại hoặc bị từ chối";
      } else if (error.message.includes("rate limit")) {
        userMessage = "Đã vượt giới hạn gửi email. Vui lòng thử lại sau.";
      }

      return { success: false, message: userMessage };
    }
  },

  /**
   * Verify SMTP transporter configuration
   * @returns {Promise<{success: boolean, message: string}>}
   */
  verifyConnection: async () => {
    try {
      await transporter.verify();
      console.log("✅ Email server is ready to send messages");
      return { success: true, message: "SMTP connection verified" };
    } catch (error) {
      console.error("❌ Email server connection failed:", error.message);
      return { success: false, message: error.message };
    }
  },
};

export default emailService;

