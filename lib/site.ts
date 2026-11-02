// The public address of the site, used for share previews, the sitemap and robots.txt.
// Set NEXT_PUBLIC_SITE_URL to a custom domain later; on Vercel the production domain is picked up automatically.
export const SITE_NAME = "Spice Route";
export const SITE_TAGLINE = "The AI waiter you can trust";
export const SITE_DESCRIPTION =
  "Order North Indian food with an AI waiter that only recommends what's really on the menu, calculates every total in code, and lets you split the bill with friends. Free to try.";

// Who made this. Shown on the About page, in footers, and in the page metadata, so anyone who opens the site can see
// it is a real, attributable project. LINKEDIN_URL is empty until the owner adds it (set NEXT_PUBLIC_LINKEDIN_URL).
export const CREATOR_NAME = "Dibyajyoti Ray";
export const CREATOR_GITHUB = "https://github.com/djtrident1998";
export const REPO_URL = "https://github.com/djtrident1998/Restaurant-Bot";
export const docUrl = (file: string) => `${REPO_URL}/blob/main/docs/${file}`;
/** The owner's LinkedIn profile, shown only if it is a real https linkedin.com address (anything else is ignored). */
export function creatorLinkedIn(env: NodeJS.ProcessEnv = process.env): string {
  const v = env.NEXT_PUBLIC_LINKEDIN_URL?.trim() ?? "";
  return /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/[^\s]*$/i.test(v) ? v : "";
}

export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "https://restaurant-bot-three.vercel.app";
}
