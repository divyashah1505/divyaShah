const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 2 * 60 * 1000); 
  return { otp, otpExpires };
};

module.exports = { generateOTP };
