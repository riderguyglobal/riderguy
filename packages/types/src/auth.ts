import { UserRole } from './enums';

/** JWT access token payload */
export interface JwtPayload {
  sub: string; // user ID
  role: UserRole;
  sessionId: string;
  iat: number;
  exp: number;
}

/** JWT refresh token payload */
export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  iat: number;
  exp: number;
}

/** Login request */
export interface LoginInput {
  phone?: string;
  email?: string;
  password?: string;
  otp?: string;
}

/** Registration request */
export interface RegisterInput {
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  role: UserRole;
  referralCode?: string;
}

/** OTP request */
export interface RequestOtpInput {
  phone: string;
  purpose: 'registration' | 'login' | 'password_reset';
}

/** OTP verification */
export interface VerifyOtpInput {
  phone: string;
  otp: string;
  purpose: 'registration' | 'login' | 'password_reset';
}

/** Auth tokens response */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

/** Active session */
export interface Session {
  id: string;
  userId: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  expiresAt: Date;
  createdAt: Date;
}
