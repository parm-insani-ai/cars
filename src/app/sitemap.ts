import type { MetadataRoute } from "next";

// sitemap.xml served at /sitemap.xml (Next App Router convention).
// Just the public marketing pages — Search Console uses this to figure out
// what to crawl and how often. Dashboards are intentionally NOT included
// (they're gated behind auth and would 3xx to /login for Googlebot).

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.PUBLIC_BASE_URL ?? "https://insani.ai").replace(/\/$/, "");
  const now = new Date();
  return [
    { url: `${base}/`,        lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/login`,   lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/signup`,  lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
