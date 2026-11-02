import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Public pages are open to search engines; account pages and the API are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/account"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
