import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  type: 'fingerprint' | 'facial' | 'iris' | 'none';
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { available: false, enrolled: false, type: 'none' };
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  let type: BiometricCapability['type'] = 'none';
  if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    type = 'facial';
  } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    type = 'fingerprint';
  } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    type = 'iris';
  }

  return { available: true, enrolled: isEnrolled, type };
}

export async function authenticateWithBiometric(
  promptMessage = 'Authenticate to continue',
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use PIN instead',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}
