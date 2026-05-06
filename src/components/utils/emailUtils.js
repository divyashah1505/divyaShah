// crudProject/src/components/utils/emailUtils.js

const nodemailer = require("nodemailer");

// ✅ Create transporter once (better performance)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    console.log("📧 Sending email to:", to);

    const info = await transporter.sendMail({
      from: `"Clothiq" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.messageId);
    return info;

  } catch (error) {
    console.error("❌ EMAIL FAILED:", error.message);

    // ❗ DO NOT BREAK YOUR API
    return null;
  }
};

module.exports = { sendEmail };