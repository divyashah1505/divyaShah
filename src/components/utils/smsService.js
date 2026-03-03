const config = require("../../../config/development.json");
const twilio = require("twilio")(config.TWILIO_SID, config.TWILIO_AUTH_TOKEN);


const sendSMS = async (to, otp) => {
    try {
        const formattedTo = to.startsWith('+') ? to : `+91${to}`;

        return await twilio.messages.create({
            body: `Your Elaunch Infotech verification code is: ${otp}`,
            from: config.TWILIO_PHONE_NUMBER,
            to: formattedTo
        });
    } catch (error) {
        console.error("SMS Sending Error:", error);
        throw new Error("Failed to send SMS");
    }
};

module.exports = { sendSMS };
