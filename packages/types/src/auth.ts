import { UserRole } from './enums';

/** JWT access token payload */
export interface JwtPayload {
  sub: string; // user ID
  role: UserRole; // primary / active role (for backwards compat)
  roles: UserRole[]; // all roles the user has
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
  otpCode: string;
}

/** OTP request */
export interface RequestOtpInput {
  phone: string;
  purpose: 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET';
}

/** OTP verification */
export interface VerifyOtpInput {
  phone: string;
  otp: string;
  purpose: 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET';
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
