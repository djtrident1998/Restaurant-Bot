import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/order", priority: 0.9 },
  { path: "/book", priority: 0.8 },
  { path: "/about", priority: 0.6 },
  { path: "/signup", priority: 0.5 },
  { path: "/login", priority: 0.4 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PAGES.map((p) => ({ url: `${base}${p.path}`, changeFrequency: "weekly", priority: p.priority }));
}
