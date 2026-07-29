// OTP generation and verification helpers.
// Twilio is NOT available (no API key in env), so we simulate SMS delivery.
// In production: plug in Twilio Verify API here.

export function generateOTP(): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

export function otpExpiresAt(): number {
  return Date.now() + 10 * 60 * 1000; // 10 minutes
}

export function isOTPExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

// Simulated SMS — logs to console in dev, returns the OTP so UI can display it
export async function sendOTPviaSMS(phone: string, otp: string): Promise<{ ok: boolean; message: string; devOtp?: string }> {
  // No Twilio key available — simulate delivery
  console.log(`[CONFI OTP] Sending OTP ${otp} to ${phone}`);
  
  // In production, replace with:
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.verify.v2.services(process.env.TWILIO_SERVICE_SID).verifications.create({ to: phone, channel: 'sms' });
  
  return {
    ok: true,
    message: `OTP sent to ${phone} (simulated — check server logs)`,
    devOtp: otp, // Remove in production!
  };
}

export async function sendOTPviaEmail(email: string, otp: string): Promise<{ ok: boolean; message: string; devOtp?: string }> {
  console.log(`[CONFI OTP] Sending OTP ${otp} to ${email}`);
  return {
    ok: true,
    message: `OTP sent to ${email} (simulated — check server logs)`,
    devOtp: otp,
  };
}