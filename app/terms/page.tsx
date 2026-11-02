import type { Metadata } from "next";
import { CONTACT_URL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of use", description: "The ground rules for using the Spice Route demo." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="2 November 2026">
      <p>By using Spice Route you agree to these terms. They are short on purpose.</p>

      <section>
        <h2>This is a demonstration</h2>
        <p>
          Spice Route is a demonstration of an AI-powered restaurant ordering experience. It is <strong>not a real restaurant</strong>: no food is prepared or delivered, <strong>no real payments are taken</strong>, and refunds and &ldquo;paid&rdquo; marks are records inside the demo only. Order status is simulated.
        </p>
      </section>

      <section>
        <h2>AI answers and allergens</h2>
        <p>
          The AI waiter answers from the demo menu and can still make mistakes. Allergen and dietary information on the menu is indicative only. <strong>If you have an allergy or medical dietary need, always confirm with the restaurant before eating.</strong> We can&apos;t guarantee that any dish is free of an allergen or free of cross-contamination.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give accurate details and keep your password private. You are responsible for what happens under your account.</li>
          <li>You can delete your account at any time from the Account page.</li>
          <li>We may suspend or remove accounts that abuse the service.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>Please don&apos;t try to break, overload or scrape the service, bypass its limits, attack other users, or use it for anything unlawful. Usage limits apply to keep the demo free for everyone.</p>
      </section>

      <section>
        <h2>Content and photos</h2>
        <p>The menu, text and code are provided for demonstration. Food photos come from Unsplash and are illustrative: they may not show the exact dish. Ratings and comments you submit stay on your account and are shown only to you.</p>
      </section>

      <section>
        <h2>No warranty and limits of liability</h2>
        <p>
          The service is provided &ldquo;as is&rdquo;, without promises that it will be available, error-free or fit for any particular purpose. To the extent the law allows, we aren&apos;t liable for losses arising from use of this free demo.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms and will change the date above when we do. See also our <a href="/privacy">privacy policy</a>. Questions: <a href={CONTACT_URL}>open an issue on our project page</a>.
        </p>
      </section>
    </LegalPage>
  );
}
