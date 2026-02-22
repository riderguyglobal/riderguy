'use client';

import { ErrorFallback } from '@riderguy/ui';

export default function AdminError({
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
      description="An error occurred in the Admin portal. Please try again."
    />
  );
}
