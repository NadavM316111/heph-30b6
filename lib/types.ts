export interface UserProfile {
  confiId: string;
  displayName: string;
  email: string | null;
  avatarIndex: number;
  phoneHash: string;
  phoneNumber: string; // masked in UI, stored encrypted
  createdAt: number;
  updatedAt: number;
  verified: boolean;
  identityCommitment: string; // SHA-256(phoneHash + confiId + timestamp)
}

export interface Session {
  token: string;
  confiId: string;
  phoneHash: string;
  issuedAt: number;
  expiresAt: number;
  signature: string; // HMAC-like commitment
}

export interface RegistrationState {
  countryCode: string;
  phoneNumber: string;
  otp: string;
  generatedOTP: string;
  otpSentAt: number | null;
  phoneHash: string;
  displayName: string;
  email: string;
  selectedAvatar: number;
  confiId: string;
  encryptionKey: CryptoKey | null;
}

export interface EncryptedCredential {
  ciphertext: string; // base64
  iv: string;         // base64
  salt: string;       // base64
  algorithm: "AES-GCM";
  keyDerivation: "PBKDF2";
  iterations: number;
}