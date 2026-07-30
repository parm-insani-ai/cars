import type { MetadataRoute } from "next";

// robots.txt served at /robots.txt (Next App Router convention).
// - Allow every crawler on public marketing routes
// - Disallow every operator/admin route so Google doesn't index dashboards
//   (which would leak internal URLs and be indexed as empty because they
//   redirect to /login for unauth'd visitors)

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.PUBLIC_BASE_URL ?? "https://insani.ai").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/outreach/",
          "/calls/",
          "/messages/",
          "/appointments/",
          "/follow-ups/",
          "/customers/",
          "/services/",
          "/providers/",
          "/agent/",
          "/hours/",
          "/reports/",
          "/settings/",
          "/knowledge/",
          "/campaigns/",
          "/demo/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
