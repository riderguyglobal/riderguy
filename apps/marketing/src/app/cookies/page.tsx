import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | RiderGuy',
  description: 'Learn about how RiderGuy uses cookies and similar technologies.',
};

export default function CookiePolicyPage() {
  return (
    <section className="px-5 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-36">
      <div className="prose prose-gray prose-headings:font-bold mx-auto max-w-3xl">
        <h1>Cookie Policy</h1>
        <p className="lead">
          Last updated: 10 April 2026
        </p>
        <p>
          This Cookie Policy explains how RiderGuy (&ldquo;we,&rdquo; &ldquo;our,&rdquo;
          or &ldquo;us&rdquo;) uses cookies and similar tracking technologies when you
          visit our website and use our applications.
        </p>

        <h2>1. What Are Cookies?</h2>
        <p>
          Cookies are small text files placed on your device when you visit a website.
          They are widely used to make websites work efficiently and to provide
          information to website owners.
        </p>

        <h2>2. Types of Cookies We Use</h2>

        <h3>2.1 Essential Cookies</h3>
        <p>
          These cookies are strictly necessary for the Platform to function. They enable
          core features such as authentication, session management, and security.
        </p>
        <table>
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>access_token</td>
              <td>User authentication</td>
              <td>Session / 15 minutes</td>
            </tr>
            <tr>
              <td>refresh_token</td>
              <td>Token refresh</td>
              <td>7 days</td>
            </tr>
          </tbody>
        </table>

        <h3>2.2 Functional Cookies</h3>
        <p>
          These cookies remember your preferences and settings to enhance your experience.
        </p>

        <h3>2.3 Analytics Cookies</h3>
        <p>
          We may use analytics cookies to understand how visitors interact with the
          Platform. Analytics data is aggregated and anonymised.
        </p>

        <h3>2.4 Local Storage</h3>
        <p>
          In addition to cookies, we use browser local storage to persist authentication
          tokens and user preferences across sessions.
        </p>

        <h2>3. Third-Party Cookies</h2>
        <p>
          Our Platform may include third-party services (e.g., Paystack for payments)
          that set their own cookies. We do not control these cookies.
        </p>

        <h2>4. Managing Cookies</h2>
        <p>You can control and manage cookies through your browser settings:</p>
        <ul>
          <li>View and delete existing cookies</li>
          <li>Block cookies from specific or all websites</li>
          <li>Set preferences for certain types of cookies</li>
          <li>Enable &ldquo;Do Not Track&rdquo; signals</li>
        </ul>
        <p>
          Blocking essential cookies may prevent you from using certain Platform features.
        </p>

        <h2>5. Changes to This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time. We will post the updated
          version on this page with a revised date.
        </p>

        <h2>6. Contact Us</h2>
        <p>
          If you have questions about our use of cookies, please contact us at{' '}
          <a href="mailto:privacy@myriderguy.com">privacy@myriderguy.com</a> or through
          our <a href="/contact">Contact page</a>.
        </p>
      </div>
    </section>
  );
}
