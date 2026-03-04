'use client';

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import type { AxiosInstance } from 'axios';

// ============================================================
// Biometric (WebAuthn) — client-side helpers for fingerprint
// and Face ID authentication.
// ============================================================

const BIOMETRIC_PHONES_KEY = 'riderguy_biometric_phones';

/**
 * Check if the current device/browser supports WebAuthn biometrics.
 */
export function isBiometricSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return browserSupportsWebAuthn();
}

/**
 * Check if a phone number has registered biometric credentials on this device.
 * We store this locally since WebAuthn credentials are device-bound.
 */
export function hasBiometricForPhone(phone: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(BIOMETRIC_PHONES_KEY);
    if (!stored) return false;
    const phones: string[] = JSON.parse(stored);
    return phones.includes(phone);
  } catch {
    return false;
  }
}

/**
 * Mark a phone as having registered biometric on this device.
 */
function addBiometricPhone(phone: string): void {
  try {
    const stored = localStorage.getItem(BIOMETRIC_PHONES_KEY);
    const phones: string[] = stored ? JSON.parse(stored) : [];
    if (!phones.includes(phone)) {
      phones.push(phone);
      localStorage.setItem(BIOMETRIC_PHONES_KEY, JSON.stringify(phones));
    }
  } catch {
    // localStorage unavailable — degrade gracefully
  }
}

/**
 * Remove a phone from the local biometric registry.
 */
export function removeBiometricPhone(phone: string): void {
  try {
    const stored = localStorage.getItem(BIOMETRIC_PHONES_KEY);
    if (!stored) return;
    const phones: string[] = JSON.parse(stored);
    const filtered = phones.filter((p) => p !== phone);
    localStorage.setItem(BIOMETRIC_PHONES_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Register a biometric credential for the currently logged-in user.
 * Must be called while authenticated.
 *
 * @returns true if registration was successful
 */
export async function registerBiometric(
  api: AxiosInstance,
  userPhone: string,
  friendlyName?: string
): Promise<boolean> {
  // 1. Request registration options from the server
  const { data: optionsRes } = await api.post('/auth/webauthn/register/options', {
    friendlyName,
  });
  const options = optionsRes.data;

  // 2. Prompt the user for biometric (fingerprint / Face ID / Windows Hello)
  let attestation;
  try {
    attestation = await startRegistration({ optionsJSON: options });
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Biometric registration was cancelled or denied');
    }
    if (err.name === 'InvalidStateError') {
      throw new Error('This biometric is already registered');
    }
    throw new Error('Biometric registration failed: ' + (err.message ?? 'Unknown error'));
  }

  // 3. Send the attestation to the server for verification
  const { data: verifyRes } = await api.post('/auth/webauthn/register/verify', {
    credential: attestation,
    friendlyName,
  });

  if (verifyRes.data?.verified) {
    // Remember that this phone has biometric on this device
    addBiometricPhone(userPhone);
    return true;
  }

  return false;
}

/**
 * Authenticate with biometric (fingerprint / Face ID).
 * Returns the server response with user + tokens.
 */
export async function authenticateWithBiometric(
  api: AxiosInstance,
  phone: string
): Promise<{
  user: any;
  accessToken: string;
  refreshToken: string;
}> {
  // 1. Request authentication options
  const { data: optionsRes } = await api.post('/auth/webauthn/login/options', { phone });
  const options = optionsRes.data;

  // 2. Prompt biometric
  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: options });
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Biometric authentication was cancelled or denied');
    }
    throw new Error('Biometric authentication failed: ' + (err.message ?? 'Unknown error'));
  }

  // 3. Verify with the server
  const { data: verifyRes } = await api.post('/auth/webauthn/login/verify', {
    phone,
    credential: assertion,
  });

  return verifyRes.data;
}
