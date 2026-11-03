import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Everything behind sign-in is private to its user; crawlers only need the public pages.
const PRIVATE = ["analyze", "analyses", "history", "interviews", "portfolio", "account", "reset-password", "goodbye"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...PRIVATE.map((path) => `/*/${path}`)],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
