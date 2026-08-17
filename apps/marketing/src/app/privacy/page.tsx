import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | RiderGuy',
  description:
    'How RiderGuy collects, uses, shares, retains, and protects your personal information across the RiderGuy and RiderGuy Rider apps and website.',
};

export default function PrivacyPolicyPage() {
  return (
    <section className="px-5 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-36">
      <div className="prose prose-gray prose-headings:font-bold mx-auto max-w-3xl">
        <h1>Privacy Policy</h1>
        <p className="lead">Last updated: 3 June 2026</p>

        <p>
          This Privacy Policy explains how RiderGuy (&ldquo;RiderGuy,&rdquo; &ldquo;we,&rdquo;
          &ldquo;our,&rdquo; or &ldquo;us&rdquo;) collects, uses, shares, retains, and protects
          your personal information when you use the <strong>RiderGuy</strong> client app, the{' '}
          <strong>RiderGuy Rider</strong> app, our websites, and related services
          (together, the &ldquo;Platform&rdquo;). It applies to both customers who request
          deliveries (&ldquo;Clients&rdquo;) and delivery partners who fulfil them
          (&ldquo;Riders&rdquo;).
        </p>
        <p>
          RiderGuy is the data controller for the personal information described here. If you
          do not agree with this Policy, please do not use the Platform.
        </p>

        <h2>1. Information We Collect</h2>

        <h3>1.1 Account &amp; Identity</h3>
        <ul>
          <li>Full name, phone number, and email address</li>
          <li>Password or PIN and authentication data (stored in hashed/secured form)</li>
          <li>Profile photo (optional)</li>
          <li>Date of birth or age confirmation, where collected</li>
        </ul>

        <h3>1.2 Rider Verification &amp; Onboarding (Riders only)</h3>
        <ul>
          <li>Government-issued identification, including national ID / Ghana Card details</li>
          <li>Selfie or liveness photo used to verify identity</li>
          <li>Vehicle information and vehicle photos</li>
          <li>Proof of address and other onboarding documents we may require</li>
          <li>Bank or mobile-money payout details for earnings withdrawals</li>
        </ul>

        <h3>1.3 Location Information</h3>
        <p>
          <strong>Clients:</strong> we collect precise (GPS) and approximate location while you
          are using the app to detect your pickup point, set drop-off locations, show nearby
          riders, and track an active delivery on the map.
        </p>
        <p>
          <strong>Riders:</strong> we collect precise location while you are using the app and,
          when you are online or completing an active delivery,{' '}
          <strong>in the background and while the app is closed or not in use</strong>. Background
          and foreground-service location is used to match you with nearby jobs, share your live
          position with the Client and our support team during an active delivery, calculate
          distances and fares, and keep a delivery-tracking notification visible while you work.
          Riders are shown an in-app disclosure and asked for permission before background
          location is enabled, and tracking stops when you go offline. See Section 4 for how to
          control location.
        </p>

        <h3>1.4 Order &amp; Delivery Information</h3>
        <ul>
          <li>Pickup, drop-off, and saved addresses</li>
          <li>Recipient names and contact details you provide</li>
          <li>Package descriptions, delivery notes, scheduling, and extra stops</li>
          <li>Proof-of-delivery photos, signatures, and delivery status updates</li>
          <li>Order history, ratings, reviews, tips, and cancellations</li>
        </ul>

        <h3>1.5 Financial &amp; Wallet Information</h3>
        <ul>
          <li>In-app wallet balance, top-ups, transactions, and order payments</li>
          <li>Rider earnings, payouts, and withdrawal history</li>
          <li>
            Card and bank payment details are collected and processed directly by our payment
            processor (Paystack). We do not store full card numbers on our servers.
          </li>
        </ul>

        <h3>1.6 Communications &amp; Support</h3>
        <ul>
          <li>In-app chat and messages between Clients, Riders, and support</li>
          <li>Support tickets, correspondence, and feedback</li>
        </ul>

        <h3>1.7 Photos &amp; Media</h3>
        <p>
          With your permission, the app uses your camera and a photo picker so you can upload a
          profile photo, proof-of-delivery images, vehicle photos, and verification documents.
          We only access the specific images you choose; we do not request persistent access to
          your full photo gallery.
        </p>

        <h3>1.8 Device &amp; Technical Information</h3>
        <ul>
          <li>Device model, operating system, app version, and language</li>
          <li>IP address and approximate network-based location</li>
          <li>Push notification tokens and Firebase installation identifiers</li>
          <li>Diagnostics, crash logs, and performance data</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>Create and manage your account and verify Rider identity and vehicles</li>
          <li>Facilitate pickups, deliveries, matching, routing, and live tracking</li>
          <li>Process payments, wallet top-ups, earnings, and payouts</li>
          <li>Send service notifications, job offers, and delivery updates</li>
          <li>Provide customer support and resolve disputes</li>
          <li>Maintain safety, prevent fraud, and enforce our Terms of Service</li>
          <li>Improve Platform reliability, performance, and features</li>
          <li>Comply with legal, tax, accounting, and regulatory obligations</li>
        </ul>

        <h2>3. Legal Bases for Processing</h2>
        <p>
          Depending on your jurisdiction, we process personal information on the basis of: your{' '}
          <strong>consent</strong> (for example, location and notification permissions);{' '}
          <strong>performance of a contract</strong> (providing the delivery service you
          request); our <strong>legitimate interests</strong> (safety, fraud prevention, and
          improving the Platform); and <strong>compliance with legal obligations</strong>.
        </p>

        <h2>4. Location Permissions &amp; Control</h2>
        <p>
          Location access is requested through your device&apos;s standard permission prompts.
          You can grant foreground-only access, allow background access (Riders), or deny access
          at any time in your device settings. If you deny or revoke location access:
        </p>
        <ul>
          <li>Clients can still enter pickup and drop-off addresses manually, with reduced convenience.</li>
          <li>Riders may be unable to go online, receive nearby jobs, or share live tracking.</li>
        </ul>
        <p>
          We never use background location for advertising, and we do not sell location data.
        </p>

        <h2>5. How We Share Information</h2>
        <p>We share personal information only as described below:</p>
        <ul>
          <li>
            <strong>Other users (to provide the service):</strong> Riders see Client names,
            pickup/drop-off and recipient details for assigned orders; Clients see the assigned
            Rider&apos;s name and live location during an active delivery.
          </li>
          <li>
            <strong>Payment processing:</strong> Paystack, to process payments, wallet funding,
            and payouts.
          </li>
          <li>
            <strong>Maps &amp; location:</strong> Google Maps Platform, to render maps, geocode
            addresses, and calculate routes.
          </li>
          <li>
            <strong>Messaging &amp; notifications:</strong> Google Firebase Cloud Messaging and
            SMS/email providers, to deliver push notifications and account messages.
          </li>
          <li>
            <strong>Infrastructure &amp; diagnostics:</strong> cloud hosting and crash/diagnostics
            providers that help us operate and maintain the Platform.
          </li>
          <li>
            <strong>Legal &amp; safety:</strong> law enforcement, regulators, or other parties
            when required by law, legal process, or to protect the rights and safety of users.
          </li>
          <li>
            <strong>Business transfers:</strong> in connection with a merger, acquisition, or
            sale of assets, subject to this Policy.
          </li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h2>6. Data Retention</h2>
        <p>
          We keep personal information for as long as your account is active and as needed to
          provide the Platform. We retain certain records for longer where required for safety,
          fraud prevention, accounting, tax, payout, dispute-resolution, and legal or regulatory
          purposes. Financial and transaction records are retained for a minimum of seven (7)
          years. When information is no longer required, we delete or anonymise it.
        </p>

        <h2>7. Account &amp; Data Deletion</h2>
        <p>
          You can request deletion of your account and associated data at any time from within
          the RiderGuy or RiderGuy Rider apps (Account &rarr; Delete Account) or via our{' '}
          <a href="/delete-account">Account Deletion page</a>. We delete profile and account
          data where deletion is legally permitted, and we retain only the records described in
          Section 6. Most requests are processed within 30 days after we verify ownership.
        </p>

        <h2>8. Data Security</h2>
        <p>
          We use industry-standard safeguards, including encryption in transit (TLS), secured
          authentication, and access controls. No method of electronic transmission or storage
          is completely secure, so we cannot guarantee absolute security.
        </p>

        <h2>9. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate or incomplete data</li>
          <li>Request deletion of your data</li>
          <li>Object to or restrict certain processing</li>
          <li>Request data portability</li>
          <li>Withdraw consent for optional processing (such as location or notifications)</li>
        </ul>
        <p>
          To exercise these rights, contact{' '}
          <a href="mailto:privacy@myriderguy.com">privacy@myriderguy.com</a>.
        </p>

        <h2>10. Children&apos;s Privacy</h2>
        <p>
          The Platform is intended for users aged 18 and older. We do not knowingly collect
          personal information from children. If you believe a child has provided us data,
          contact us and we will delete it.
        </p>

        <h2>11. International Data Transfers</h2>
        <p>
          We operate primarily in Ghana and may process and store information on servers located
          in other countries. Where we transfer data internationally, we take steps to ensure it
          remains protected in line with this Policy and applicable law.
        </p>

        <h2>12. Push Notifications</h2>
        <p>
          With your permission, we send push notifications for job offers, order status, wallet
          activity, and service updates. You can disable notifications in your device settings;
          some operational messages may still be delivered in-app.
        </p>

        <h2>13. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the updated version
          here with a new &ldquo;Last updated&rdquo; date and, for material changes, notify you
          through the Platform or by email. Continued use after changes take effect constitutes
          acceptance.
        </p>

        <h2>14. Contact Us</h2>
        <p>
          For questions, requests, or complaints about this Privacy Policy or your data, contact
          our privacy team at{' '}
          <a href="mailto:privacy@myriderguy.com">privacy@myriderguy.com</a> or through our{' '}
          <a href="/contact">Contact page</a>. RiderGuy operates under the laws of the Republic
          of Ghana.
        </p>
      </div>
    </section>
  );
}
