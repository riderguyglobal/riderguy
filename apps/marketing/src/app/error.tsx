'use client';

import { ErrorFallback } from '@riderguy/ui';

export default function MarketingError({
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
      description="An unexpected error occurred. Please try again."
    />
  );
}
