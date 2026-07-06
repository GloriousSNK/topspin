import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

// Served at /manifest.webmanifest — lets the site install as an app and gives
// search engines the name, colours and icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TopSpin — Tennis Practice Lab",
    short_name: "TopSpin",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2e8",
    theme_color: "#17673a",
    categories: ["sports", "health", "education"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
