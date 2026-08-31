/** Express 5 wildcards must be named; unnamed `*` routes crash at startup. */
export const AUTHENTICATED_UPLOAD_ROUTE = '/uploads/*filePath';

const SAFE_UPLOAD_SEGMENT = /^[A-Za-z0-9_.-]{1,255}$/;

/** Avatars are the only upload class intentionally readable without a JWT. */
export function isPublicAvatarUploadPath(filePath: unknown): filePath is string[] {
  return Array.isArray(filePath)
    && filePath.length >= 2
    && filePath[0] === 'avatars'
    && filePath.every((segment) => (
      typeof segment === 'string'
      && segment !== '.'
      && segment !== '..'
      && SAFE_UPLOAD_SEGMENT.test(segment)
    ));
}
