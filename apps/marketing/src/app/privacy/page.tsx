import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — RiderGuy',
  description: 'Learn how RiderGuy collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-3xl prose prose-gray prose-headings:font-bold">
        <h1>Privacy Policy</h1>
        <p className="lead">
          Last updated: {new Date().toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p>
          RiderGuy (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting
          your privacy. This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you use our mobile and web applications
          (the &ldquo;Platform&rdquo;).
        </p>

        <h2>1. Information We Collect</h2>

        <h3>1.1 Personal Information</h3>
        <p>When you create an account, we may collect:</p>
        <ul>
          <li>Full name</li>
          <li>Phone number</li>
          <li>Email address</li>
          <li>Profile photo</li>
          <li>Government-issued ID (riders only)</li>
          <li>Vehicle information (riders only)</li>
        </ul>

        <h3>1.2 Location Data</h3>
        <p>
          We collect real-time GPS location data when you use the Platform. For riders,
          location is collected while the app is in use to facilitate deliveries. For clients,
          location is used to determine pickup and drop-off points.
        </p>

        <h3>1.3 Transaction Data</h3>
        <p>
          We record delivery requests, payment transactions, wallet activity, earnings,
          tips, and order history.
        </p>

        <h3>1.4 Device Information</h3>
        <p>
          We automatically collect device type, operating system, browser type, IP address,
          and push notification tokens.
        </p>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>Facilitate pickup and delivery services</li>
          <li>Process payments and payouts</li>
          <li>Verify rider identity and vehicle compliance</li>
          <li>Provide customer support</li>
          <li>Send service notifications and updates</li>
          <li>Enforce our Terms of Service</li>
          <li>Improve Platform performance and safety</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. Sharing of Information</h2>
        <p>We may share your information with:</p>
        <ul>
          <li><strong>Other users:</strong> Riders see client names and delivery addresses; clients see rider names and real-time location during active deliveries.</li>
          <li><strong>Payment processors:</strong> We share necessary data with Paystack to process payments.</li>
          <li><strong>Service providers:</strong> Cloud hosting, analytics, and communication service providers who assist in operating the Platform.</li>
          <li><strong>Law enforcement:</strong> When required by law, subpoena, or legal process.</li>
        </ul>

        <h2>4. Data Retention</h2>
        <p>
          We retain personal data for as long as your account is active or as needed to
          provide services. Transaction records are retained for a minimum of 7 years
          for compliance purposes. You may request deletion of your account data by
          contacting us.
        </p>

        <h2>5. Data Security</h2>
        <p>
          We implement industry-standard security measures including encryption in
          transit (TLS), secure authentication (JWT), and access controls. However, no
          method of electronic transmission is 100% secure, and we cannot guarantee
          absolute security.
        </p>

        <h2>6. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your data</li>
          <li>Object to or restrict processing</li>
          <li>Data portability</li>
          <li>Withdraw consent for optional data processing</li>
        </ul>

        <h2>7. Children&apos;s Privacy</h2>
        <p>
          The Platform is not intended for users under 18 years of age. We do not
          knowingly collect information from children.
        </p>

        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of
          material changes through the Platform or via email. Continued use after changes
          constitutes acceptance.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:privacy@riderguy.com">privacy@riderguy.com</a> or through
          our <a href="/contact">Contact page</a>.
        </p>
      </div>
    </section>
  );
}
