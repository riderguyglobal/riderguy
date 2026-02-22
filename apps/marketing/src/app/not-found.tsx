import { NotFoundPage } from '@riderguy/ui';

export default function MarketingNotFound() {
  return (
    <NotFoundPage
      heading="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
      backHref="/"
      backLabel="Go Home"
    />
  );
}
