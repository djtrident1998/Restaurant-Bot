// The public address of the site, used for share previews, the sitemap and robots.txt.
// Set NEXT_PUBLIC_SITE_URL to a custom domain later; on Vercel the production domain is picked up automatically.
export const SITE_NAME = "Spice Route";
export const SITE_TAGLINE = "The AI waiter you can trust";
export const SITE_DESCRIPTION =
  "Order North Indian food with an AI waiter that only recommends what's really on the menu, calculates every total in code, and lets you split the bill with friends. Free to try.";

export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "https://restaurant-bot-three.vercel.app";
}
