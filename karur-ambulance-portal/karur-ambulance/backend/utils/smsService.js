// utils/smsService.js
// SMS OTP delivery — mocked in dev, real Twilio in production

let twilioClient = null;

// Lazily initialise Twilio only when OTP_MOCK is false
const getTwilioClient = () => {
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
};

/**
 * Send an OTP SMS to the given mobile number.
 * In mock mode, logs the OTP to the console instead.
 *
 * @param {string} mobile - 10-digit Indian mobile number
 * @param {string} otp    - 6-digit OTP code
 * @returns {Promise<{success: boolean, messageId?: string, mock?: boolean}>}
 */
const sendOTP = async (mobile, otp) => {
  const isMock = process.env.OTP_MOCK === 'true';

  if (isMock) {
    // --- MOCK MODE ---
    console.log(`\n📱 [MOCK SMS] To: +91${mobile}  OTP: ${otp}\n`);
    return { success: true, mock: true, messageId: `mock_${Date.now()}` };
  }

  // --- PRODUCTION (Twilio) ---
  try {
    const client = getTwilioClient();
    const message = await client.messages.create({
      body: `Your Karur Emergency Ambulance Portal OTP is: ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do not share this with anyone.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${mobile}`,
    });
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Twilio SMS error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOTP };
