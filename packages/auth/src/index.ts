// ============================================================
// @riderguy/auth — shared authentication package
// ============================================================

// API client
export { initApiClient, getApiClient } from './api-client';

// Token storage
export { tokenStorage } from './token-storage';

// Zustand auth store
export { useAuthStore, type AuthUser, type AuthState } from './auth-store';

// React AuthProvider + useAuth hook
export { AuthProvider, useAuth } from './auth-provider';

// ProtectedRoute guard
export { ProtectedRoute } from './protected-route';

// Session management UI
export { SessionManager } from './session-manager';

// Biometric (WebAuthn) helpers
export {
  isBiometricSupported,
  hasBiometricForPhone,
  removeBiometricPhone,
  registerBiometric,
  authenticateWithBiometric,
} from './biometric';
