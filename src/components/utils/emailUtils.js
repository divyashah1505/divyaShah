const nodemailer = require("nodemailer");
const config = require("../../../config/development");

const transporter = nodemailer.createTransport({
  service: "gmail", // ✅ more stable
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Clothiq" <${config.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return info;
  } catch (error) {
    console.error("SMTP ERROR:", error.message);

    // ❗ DO NOT BREAK YOUR API
    return null;
  }
};

module.exports = { sendEmail };