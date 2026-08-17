import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delete Your Account | RiderGuy',
  description: 'Request deletion of your RiderGuy client or rider account.',
};

export default function DeleteAccountPage() {
  return (
    <section className="px-5 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-36">
      <div className="prose prose-gray prose-headings:font-bold mx-auto max-w-3xl">
        <h1>Delete Your Account</h1>
        <p className="lead">Last updated: 1 June 2026</p>
        <p>
          You can request deletion of your RiderGuy client or rider account from inside
          the RiderGuy mobile apps or by contacting our privacy team.
        </p>

        <h2>How to Request Deletion</h2>
        <ol>
          <li>Open the RiderGuy or RiderGuy Rider app.</li>
          <li>Go to Account, then choose Delete Account.</li>
          <li>Submit the deletion request with a confirmation email address.</li>
        </ol>
        <p>
          If you cannot access the app, email{' '}
          <a href="mailto:privacy@myriderguy.com?subject=Delete%20my%20RiderGuy%20account">
            privacy@myriderguy.com
          </a>{' '}
          from the email address on your account. If your account only has a phone number,
          include that phone number so we can verify ownership.
        </p>

        <h2>Data We Delete</h2>
        <ul>
          <li>Account profile details where deletion is legally permitted</li>
          <li>App device tokens and notification registration data</li>
          <li>Saved app preferences and non-required profile media</li>
          <li>Rider onboarding media that is no longer legally required</li>
        </ul>

        <h2>Data We May Retain</h2>
        <p>
          We may retain records that are required for safety, fraud prevention, accounting,
          tax, legal, dispute, payout, or regulatory purposes. This can include delivery
          history, payment records, payout records, fraud-prevention logs, support tickets,
          and legally required rider verification records.
        </p>

        <h2>Processing Time</h2>
        <p>
          We review deletion requests after verifying account ownership. Most requests are
          processed within 30 days unless a longer retention period is legally required.
        </p>

        <h2>Questions</h2>
        <p>
          For questions about account deletion or privacy rights, contact{' '}
          <a href="mailto:privacy@myriderguy.com">privacy@myriderguy.com</a> or use our{' '}
          <a href="/contact">Contact page</a>.
        </p>
      </div>
    </section>
  );
}
