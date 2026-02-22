import { AccountStatus, UserRole } from './enums';

/** Base user — every person on the platform has this */
export interface User {
  id: string;
  email: string | null;
  phone: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal user info for lists and references */
export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
}

/** Input for creating a new user */
export interface CreateUserInput {
  phone: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  referralCode?: string;
}

/** Input for updating user profile */
export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
}
