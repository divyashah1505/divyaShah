const nodemailer = require("nodemailer");
const config = require("../../../config/development.json");
const { appString } = require("./appString");
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
   const mailOptions = {
      from: `"Elaunch Infotech" <${config.SMTP_USER}>`,
      to,
      subject,
      html,
    };
 const info = await transporter.sendMail(mailOptions);
    // console.log(appString.SENTSUCCESSFULLY, info.messageId);
    return info;
  } catch (error) {
    console.error(appString.SMTPERROR, error);

    throw new Error(appString.SERVICEUNAVAILABLE);
  }
};

module.exports = { sendEmail };
