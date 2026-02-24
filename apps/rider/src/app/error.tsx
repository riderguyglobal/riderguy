'use client';

import { ErrorFallback } from '@riderguy/ui';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} />;
}
