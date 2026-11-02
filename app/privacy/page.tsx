import type { Metadata } from "next";
import { CONTACT_URL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy", description: "What Spice Route stores about you, who processes it, and how to download or delete it." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="2 November 2026">
      <p>
        Spice Route is a demonstration restaurant with an AI waiter. This page explains, in plain language, what we store, why, and what you can do about it. We collect only what the app needs to work.
      </p>

      <section>
        <h2>What we store</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, email address and a salted, one-way hash of your password. We never store your actual password.
          </li>
          <li>
            <strong>Your orders:</strong> the dishes, quantities, totals and times of orders you place, any cancellation or refund entry, how you split a bill (names you typed and who has paid), and ratings or comments you leave.
          </li>
          <li>
            <strong>Your shopping cart and session:</strong> kept temporarily in server memory while you order. It is not a permanent record and can reset at any time.
          </li>
          <li>
            <strong>Technical logs:</strong> short operational logs (which AI model answered, how many tokens it used, errors). They do not contain your messages or your account details.
          </li>
        </ul>
        <p className="mt-2">We do not sell your data, show ads, or use advertising or analytics trackers.</p>
      </section>

      <section>
        <h2>Your chat messages and the AI</h2>
        <p>
          Menu browsing, the cart, checkout, cancellation and split buttons are handled by our own code and send nothing to an AI provider. When you ask a free-form question, your recent messages (not your name or email) are sent to an AI provider to produce an answer: <strong>Groq</strong>, <strong>Google (Gemini)</strong> or <strong>Anthropic (Claude)</strong>, in that order of preference. We do not keep a server-side copy of your conversation; it lives in your browser tab. Please don&apos;t type sensitive personal information into the chat.
        </p>
      </section>

      <section>
        <h2>Voice</h2>
        <p>
          If you use the microphone button, your browser&apos;s built-in speech recognition turns your voice into text. In Chrome and Edge the browser sends the audio to its vendor&apos;s speech service to do this. We never receive or store your audio, only the text you choose to send.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>Only two, both essential:</p>
        <ul>
          <li>
            <code>sr_session</code> — keeps you signed in. It is signed, HttpOnly and expires after 7 days.
          </li>
          <li>
            <code>sr_name</code> — your first name, so the home page can greet you. It is display-only and expires after 7 days.
          </li>
        </ul>
        <p className="mt-2">Because these are strictly necessary, we don&apos;t show a cookie banner.</p>
      </section>

      <section>
        <h2>Who processes your data</h2>
        <ul>
          <li>
            <strong>Vercel</strong> hosts the app and stores accounts in a private Vercel Blob store.
          </li>
          <li>
            <strong>Groq, Google and Anthropic</strong> process the text of AI questions as described above.
          </li>
          <li>
            <strong>Unsplash</strong> serves the food photos. Your browser requests them directly, so Unsplash can see your IP address and browser details.
          </li>
        </ul>
      </section>

      <section>
        <h2>Keeping it, and your rights</h2>
        <p>
          We keep your account until you delete it. From your <a href="/account">Account page</a> you can <strong>download a copy of your data</strong> (JSON) and <strong>permanently delete your account</strong> with your password. Deletion removes your profile, order history, ratings and splits. Short-lived technical logs expire on their own. If you are in the EU/UK or India you also have the right to correct your data and to complain to your regulator; for anything else, <a href={CONTACT_URL}>contact us</a>.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Passwords are hashed with scrypt, sign-in is rate-limited, accounts live in a private store, and the site is served over HTTPS with modern browser protections. No system is perfectly secure, and this is a demo, so please use a password you don&apos;t use elsewhere.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>Spice Route is not meant for children under 16.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If we change this policy we will update the date above. Questions or requests: <a href={CONTACT_URL}>open an issue on our project page</a>.
        </p>
      </section>
    </LegalPage>
  );
}
