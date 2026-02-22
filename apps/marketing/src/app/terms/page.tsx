import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — RiderGuy',
  description: 'Read the RiderGuy Terms of Service governing use of our delivery platform.',
};

export default function TermsPage() {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-3xl prose prose-gray prose-headings:font-bold">
        <h1>Terms of Service</h1>
        <p className="lead">
          Last updated: {new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p>
          Welcome to RiderGuy. These Terms of Service (&ldquo;Terms&rdquo;) govern your
          access to and use of the RiderGuy platform, mobile applications, and website
          (collectively, the &ldquo;Platform&rdquo;). By accessing or using the Platform,
          you agree to be bound by these Terms.
        </p>

        <h2>1. Definitions</h2>
        <ul>
          <li><strong>&ldquo;Client&rdquo;</strong> — any user who requests a delivery through the Platform.</li>
          <li><strong>&ldquo;Rider&rdquo;</strong> — any independent contractor who fulfils deliveries through the Platform.</li>
          <li><strong>&ldquo;Partner&rdquo;</strong> — any business that uses the Platform for commercial deliveries.</li>
          <li><strong>&ldquo;Order&rdquo;</strong> — a delivery request placed through the Platform.</li>
        </ul>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old to use the Platform. Riders must additionally
          hold a valid means of identification, possess a roadworthy vehicle, and
          successfully complete the onboarding verification process.
        </p>

        <h2>3. Account Registration</h2>
        <p>
          You agree to provide accurate, current, and complete information during
          registration and to keep your account information updated. You are responsible
          for safeguarding your account credentials and for all activities under your
          account.
        </p>

        <h2>4. Platform Services</h2>
        <p>
          RiderGuy acts as a technology intermediary connecting Clients with independent
          Riders. We do not directly provide delivery services. Riders are independent
          contractors and not employees, agents, or representatives of RiderGuy.
        </p>

        <h2>5. Pricing and Payments</h2>
        <ul>
          <li>Delivery fees are calculated based on distance, base fare, zone pricing, and surge multipliers.</li>
          <li>A 10% service fee is applied to each order.</li>
          <li>Payments are processed through Paystack. By using the Platform, you agree to Paystack&apos;s terms.</li>
          <li>Rider earnings are deposited into in-app wallets and may be withdrawn to linked bank accounts subject to minimum withdrawal thresholds.</li>
          <li>Tips are optional and go directly to the rider, less any applicable processing fees.</li>
        </ul>

        <h2>6. Rider Obligations</h2>
        <p>As a Rider, you agree to:</p>
        <ul>
          <li>Maintain valid identification and vehicle registration</li>
          <li>Handle packages with care and deliver them in the received condition</li>
          <li>Follow all applicable traffic and safety laws</li>
          <li>Not subcontract or delegate deliveries to third parties</li>
          <li>Maintain appropriate insurance coverage for your vehicle</li>
          <li>Complete deliveries in a timely manner</li>
        </ul>

        <h2>7. Client Obligations</h2>
        <p>As a Client, you agree to:</p>
        <ul>
          <li>Provide accurate pickup and delivery information</li>
          <li>Not request delivery of prohibited, illegal, or hazardous items</li>
          <li>Be available at the pickup location or designate a representative</li>
          <li>Pay the quoted delivery fee and any applicable charges</li>
        </ul>

        <h2>8. Prohibited Items</h2>
        <p>The following items may not be sent through the Platform:</p>
        <ul>
          <li>Illegal substances or contraband</li>
          <li>Weapons, firearms, or explosives</li>
          <li>Hazardous materials</li>
          <li>Live animals</li>
          <li>Currency, negotiable instruments, or precious metals</li>
          <li>Items requiring special licensing or permits</li>
        </ul>

        <h2>9. Cancellation Policy</h2>
        <p>
          Clients may cancel an order before a rider accepts it at no charge. Once a rider
          has accepted and is en route, a cancellation fee may apply. RiderGuy reserves
          the right to cancel orders that violate these Terms.
        </p>

        <h2>10. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, RiderGuy shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, including loss
          of profits, data, or goodwill. Our total liability for any claim shall not exceed
          the amount you paid through the Platform in the 12 months preceding the claim.
        </p>

        <h2>11. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless RiderGuy, its officers, directors,
          employees, and agents from any claims, damages, or expenses arising from your
          use of the Platform or violation of these Terms.
        </p>

        <h2>12. Account Suspension and Termination</h2>
        <p>
          We may suspend or terminate your account at our discretion if we believe you
          have violated these Terms, engaged in fraudulent activity, or pose a risk to
          the safety of other users. You may deactivate your account at any time through
          the Platform settings.
        </p>

        <h2>13. Dispute Resolution</h2>
        <p>
          Any disputes arising from these Terms or your use of the Platform shall be
          resolved through binding arbitration in Lagos, Nigeria, in accordance with
          applicable Nigerian arbitration laws.
        </p>

        <h2>14. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws
          of the Federal Republic of Nigeria.
        </p>

        <h2>15. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. Material changes will
          be communicated through the Platform. Continued use after modifications
          constitutes acceptance.
        </p>

        <h2>16. Contact</h2>
        <p>
          Questions about these Terms may be directed to{' '}
          <a href="mailto:legal@riderguy.com">legal@riderguy.com</a> or through our{' '}
          <a href="/contact">Contact page</a>.
        </p>
      </div>
    </section>
  );
}
