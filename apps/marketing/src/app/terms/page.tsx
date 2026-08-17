import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | RiderGuy',
  description: 'Read the RiderGuy Terms of Service governing use of our delivery platform and mobile apps.',
};

export default function TermsPage() {
  return (
    <section className="px-5 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-36">
      <div className="prose prose-gray prose-headings:font-bold mx-auto max-w-3xl">
        <h1>Terms of Service</h1>
        <p className="lead">Last updated: 3 June 2026</p>
        <p>
          Welcome to RiderGuy. These Terms of Service (&ldquo;Terms&rdquo;) govern your access
          to and use of the RiderGuy platform, mobile applications (RiderGuy and RiderGuy
          Rider), and website (collectively, the &ldquo;Platform&rdquo;). By accessing or using
          the Platform, you agree to be bound by these Terms and by our{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>1. Definitions</h2>
        <ul>
          <li><strong>&ldquo;Client&rdquo;</strong>: any user who requests a delivery through the Platform.</li>
          <li><strong>&ldquo;Rider&rdquo;</strong>: any independent contractor who fulfils deliveries through the Platform.</li>
          <li><strong>&ldquo;Partner&rdquo;</strong>: any business that uses the Platform for commercial deliveries.</li>
          <li><strong>&ldquo;Order&rdquo;</strong>: a delivery request placed through the Platform.</li>
        </ul>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old to use the Platform. Riders must additionally hold
          valid identification, possess a roadworthy vehicle, and successfully complete the
          onboarding verification process.
        </p>

        <h2>3. Account Registration</h2>
        <p>
          You agree to provide accurate, current, and complete information during registration
          and to keep your account information updated. You are responsible for safeguarding
          your account credentials and for all activities under your account.
        </p>

        <h2>4. Platform Services</h2>
        <p>
          RiderGuy acts as a technology intermediary connecting Clients with independent Riders.
          We do not directly provide delivery services. Riders are independent contractors and
          not employees, agents, or representatives of RiderGuy.
        </p>

        <h2>5. Licence to Use the Apps</h2>
        <p>
          Subject to these Terms, RiderGuy grants you a limited, non-exclusive, non-transferable,
          revocable licence to download and use the RiderGuy and RiderGuy Rider apps on a device
          you own or control, for personal or contracting use. You may not copy, modify,
          reverse-engineer, resell, or create derivative works from the apps, or use them for
          any unlawful purpose.
        </p>

        <h2>6. Pricing and Payments</h2>
        <ul>
          <li>Delivery fees are calculated based on distance, base fare, zone pricing, and surge multipliers.</li>
          <li>A service fee is applied to each order, as disclosed at checkout.</li>
          <li>Payments are processed through Paystack. By using the Platform, you agree to Paystack&apos;s terms.</li>
          <li>Rider earnings are deposited into in-app wallets and may be withdrawn to linked bank or mobile-money accounts subject to minimum withdrawal thresholds.</li>
          <li>Tips are optional and go directly to the rider, less any applicable processing fees.</li>
          <li>
            The Platform is used to pay for physical delivery and transportation services and to
            fund a wallet used for those services. We do not sell digital goods, in-app digital
            subscriptions, or other digital content through the apps.
          </li>
        </ul>

        <h2>7. Rider Obligations</h2>
        <p>As a Rider, you agree to:</p>
        <ul>
          <li>Maintain valid identification and vehicle registration</li>
          <li>Handle packages with care and deliver them in the received condition</li>
          <li>Follow all applicable traffic and safety laws</li>
          <li>Not subcontract or delegate deliveries to third parties</li>
          <li>Maintain appropriate insurance coverage for your vehicle</li>
          <li>Complete deliveries in a timely manner</li>
        </ul>

        <h2>8. Rider Location &amp; Tracking Consent</h2>
        <p>
          To match you with nearby jobs and let Clients and support follow active deliveries, the
          RiderGuy Rider app collects your location while the app is in use and, when you are
          online or completing a delivery, in the background and while the app is closed or not in
          use. A foreground-service notification is shown while tracking is active. By going
          online, you consent to this collection and use as described in our{' '}
          <a href="/privacy">Privacy Policy</a>. You can stop background tracking at any time by
          going offline or revoking the permission in your device settings, which may limit your
          ability to receive jobs.
        </p>

        <h2>9. Client Obligations</h2>
        <p>As a Client, you agree to:</p>
        <ul>
          <li>Provide accurate pickup and delivery information</li>
          <li>Not request delivery of prohibited, illegal, or hazardous items</li>
          <li>Be available at the pickup location or designate a representative</li>
          <li>Pay the quoted delivery fee and any applicable charges</li>
        </ul>

        <h2>10. Prohibited Items</h2>
        <p>The following items may not be sent through the Platform:</p>
        <ul>
          <li>Illegal substances or contraband</li>
          <li>Weapons, firearms, or explosives</li>
          <li>Hazardous materials</li>
          <li>Live animals</li>
          <li>Currency, negotiable instruments, or precious metals</li>
          <li>Items requiring special licensing or permits</li>
        </ul>

        <h2>11. Cancellation Policy</h2>
        <p>
          Clients may cancel an order before a rider accepts it at no charge. Once a rider has
          accepted and is en route, a cancellation fee may apply. RiderGuy reserves the right to
          cancel orders that violate these Terms.
        </p>

        <h2>12. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, RiderGuy shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages. Our total liability for any
          claim shall not exceed the amount you paid through the Platform in the 12 months
          preceding the claim.
        </p>

        <h2>13. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless RiderGuy, its officers, directors, employees,
          and agents from any claims, damages, or expenses arising from your use of the Platform
          or violation of these Terms.
        </p>

        <h2>14. Account Suspension and Termination</h2>
        <p>
          We may suspend or terminate your account at our discretion if we believe you have
          violated these Terms, engaged in fraudulent activity, or pose a risk to the safety of
          other users. You may stop using the Platform and delete your account at any time via
          the in-app option or our <a href="/delete-account">Account Deletion page</a>.
        </p>

        <h2>15. Mobile Apps &amp; App Stores</h2>
        <p>
          Your use of the apps is also subject to the rules of the app store from which you
          obtained them, including Google Play. Where you obtain the app through Google Play, you
          acknowledge that Google is not a party to these Terms and is not responsible for the
          apps or their content. The apps require certain device permissions (such as location,
          camera, and notifications) to function; you control these permissions in your device
          settings.
        </p>

        <h2>16. Dispute Resolution</h2>
        <p>
          Any disputes arising from these Terms or your use of the Platform shall be resolved
          through binding arbitration in Accra, Ghana, in accordance with applicable Ghanaian
          arbitration laws.
        </p>

        <h2>17. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the
          Republic of Ghana.
        </p>

        <h2>18. Severability &amp; Entire Agreement</h2>
        <p>
          If any provision of these Terms is found unenforceable, the remaining provisions stay
          in full effect. These Terms, together with the Privacy Policy, constitute the entire
          agreement between you and RiderGuy regarding the Platform.
        </p>

        <h2>19. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. Material changes will be
          communicated through the Platform. Continued use constitutes acceptance.
        </p>

        <h2>20. Contact</h2>
        <p>
          Questions about these Terms may be directed to{' '}
          <a href="mailto:legal@myriderguy.com">legal@myriderguy.com</a> or through our{' '}
          <a href="/contact">Contact page</a>.
        </p>
      </div>
    </section>
  );
}
