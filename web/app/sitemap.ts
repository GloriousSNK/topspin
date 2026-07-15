import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Served at /sitemap.xml — the public, indexable pages, most important first.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "", priority: 1.0, freq: "weekly" },
    { path: "/analyze", priority: 0.9, freq: "monthly" },
    { path: "/batch", priority: 0.75, freq: "monthly" },
    { path: "/ball-lab", priority: 0.8, freq: "monthly" },
    { path: "/workouts", priority: 0.8, freq: "monthly" },
    { path: "/learn", priority: 0.7, freq: "monthly" },
    { path: "/about", priority: 0.6, freq: "yearly" },
    { path: "/insights", priority: 0.4, freq: "daily" },
    { path: "/privacy", priority: 0.3, freq: "yearly" },
  ];
  return pages.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
