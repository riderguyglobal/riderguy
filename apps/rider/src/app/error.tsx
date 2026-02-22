'use client';

import { ErrorFallback } from '@riderguy/ui';

export default function RiderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Something went wrong"
      description="An unexpected error occurred in the Rider app. Please try again."
    />
  );
}
