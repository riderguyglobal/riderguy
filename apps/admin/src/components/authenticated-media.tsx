'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { API_BASE_URL } from '@/lib/constants';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function getFallbackOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

/**
 * Convert a local upload path returned by the API into the authenticated API
 * route that serves it. Remote object-storage URLs are intentionally kept as
 * returned by the API.
 */
export function resolveMediaUrl(source: string, apiBaseUrl = API_BASE_URL): string {
  const value = source.trim();
  const baseUrl = trimTrailingSlashes(apiBaseUrl);
  const fallbackOrigin = getFallbackOrigin();

  let parsedBase: URL | null = null;
  try {
    parsedBase = new URL(baseUrl, fallbackOrigin);
  } catch {
    // Keep the simple relative-path behavior below for unusual local configs.
  }

  if (value.startsWith('/uploads/')) {
    return `${baseUrl}${value}`;
  }

  if (value.startsWith('uploads/')) {
    return `${baseUrl}/${value}`;
  }

  if (parsedBase) {
    const apiUploadPath = `${trimTrailingSlashes(parsedBase.pathname)}/uploads/`;

    if (value.startsWith(apiUploadPath)) {
      return `${parsedBase.origin}${value}`;
    }

    try {
      const parsedSource = new URL(value);
      if (
        parsedSource.origin === parsedBase.origin &&
        parsedSource.pathname.startsWith('/uploads/')
      ) {
        return `${baseUrl}${parsedSource.pathname}${parsedSource.search}${parsedSource.hash}`;
      }
    } catch {
      // Non-absolute values that are not recognized upload paths pass through.
    }
  }

  return value;
}

/** Return true only for local uploads served by the authenticated API route. */
export function isAuthenticatedMediaUrl(source: string, apiBaseUrl = API_BASE_URL): boolean {
  const value = source.trim();
  if (value.startsWith('/uploads/') || value.startsWith('uploads/')) return true;

  try {
    const fallbackOrigin = getFallbackOrigin();
    const base = new URL(apiBaseUrl, fallbackOrigin);
    const resolved = new URL(resolveMediaUrl(value, apiBaseUrl), fallbackOrigin);
    const uploadPath = `${trimTrailingSlashes(base.pathname)}/uploads/`;

    return resolved.origin === base.origin && resolved.pathname.startsWith(uploadPath);
  } catch {
    return false;
  }
}

async function fetchAuthenticatedMedia(
  api: AxiosInstance,
  source: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await api.get<Blob>(resolveMediaUrl(source), {
    responseType: 'blob',
    signal,
  });

  return response.data instanceof Blob ? response.data : new Blob([response.data]);
}

type AuthenticatedImageProps = Omit<ImageProps, 'src'> & {
  api: AxiosInstance;
  src: string | null | undefined;
  onMediaError?: (error: unknown) => void;
};

/**
 * Next/Image cannot attach an Authorization header. For a local private upload,
 * fetch through the shared authenticated API client and render a short-lived
 * object URL instead. Public/remote media continues through Next/Image normally.
 */
export function AuthenticatedImage({
  api,
  src,
  onMediaError,
  unoptimized,
  ...imageProps
}: AuthenticatedImageProps) {
  const resolvedSource = useMemo(() => (src ? resolveMediaUrl(src) : null), [src]);
  const requiresAuth = useMemo(() => (src ? isAuthenticatedMediaUrl(src) : false), [src]);
  const [displaySource, setDisplaySource] = useState<string | null>(
    requiresAuth ? null : resolvedSource,
  );

  useEffect(() => {
    if (!src || !resolvedSource) {
      setDisplaySource(null);
      return;
    }

    if (!requiresAuth) {
      setDisplaySource(resolvedSource);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    let cancelled = false;
    setDisplaySource(null);

    void fetchAuthenticatedMedia(api, src, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setDisplaySource(objectUrl);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) onMediaError?.(error);
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, onMediaError, requiresAuth, resolvedSource, src]);

  if (!displaySource) return null;

  return <Image {...imageProps} src={displaySource} unoptimized={requiresAuth || unoptimized} />;
}

/** Open private local media without putting a bearer token into the URL. */
export async function openAuthenticatedMedia(api: AxiosInstance, source: string): Promise<void> {
  const resolvedSource = resolveMediaUrl(source);

  if (!isAuthenticatedMediaUrl(source)) {
    window.open(resolvedSource, '_blank', 'noopener,noreferrer');
    return;
  }

  // Open synchronously from the click event so popup blockers do not discard
  // the eventual blob navigation while the authenticated request is in flight.
  const pendingWindow = window.open('about:blank', '_blank');
  if (pendingWindow) pendingWindow.opener = null;

  try {
    const blob = await fetchAuthenticatedMedia(api, source);
    const objectUrl = URL.createObjectURL(blob);

    if (pendingWindow && !pendingWindow.closed) {
      pendingWindow.location.replace(objectUrl);
    } else {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    pendingWindow?.close();
    throw error;
  }
}
