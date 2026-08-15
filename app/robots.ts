// app/robots.ts
import type { MetadataRoute } from "next";

const SITE_URL = "https://billio.jblessconsulting.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard/",
        "/login",
        "/signup",
        "/settings/",
        "/admin/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}