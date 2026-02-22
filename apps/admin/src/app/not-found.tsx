import { NotFoundPage } from '@riderguy/ui';

export default function AdminNotFound() {
  return (
    <NotFoundPage
      heading="Page not found"
      message="This admin page doesn't exist."
      backHref="/dashboard"
      backLabel="Go to Dashboard"
    />
  );
}
