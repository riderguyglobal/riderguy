import { NotFoundPage } from '@riderguy/ui';

export default function RiderNotFound() {
  return (
    <NotFoundPage
      heading="Page not found"
      message="The page you're looking for doesn't exist."
      backHref="/dashboard"
      backLabel="Go to Dashboard"
    />
  );
}
