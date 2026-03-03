const emailTemplates = {
  verificationOTP: (otp) => {
    return `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
        <div style="text-align: center; border-bottom: 1px solid #eee; padding-bottom: 20px;">
          <h1 style="color: #333;">Elaunch Infotech</h1>
        </div>
        <div style="padding: 20px 0;">
          <h2 style="color: #444;">Verify Your Account</h2>
          <p style="font-size: 16px; color: #666; line-height: 1.5;">
            Thank you for choosing us! Use the following One-Time Password (OTP) to complete your registration.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff; border: 2px dashed #007bff; padding: 10px 20px; border-radius: 5px;">
              ${otp}
            </span>
          </div>
          <p style="font-size: 14px; color: #999;">
            This OTP is valid for <b>1 minutes</b>. If you did not request this, please ignore this email.
          </p>
        </div>
        <div style="text-align: center; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #aaa;">
          &copy; ${new Date().getFullYear()} Elaunch Infotech. All rights reserved.
        </div>
      </div>
    `;
  },
};

module.exports = emailTemplates;
