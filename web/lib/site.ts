// One source of truth for site identity, shared by metadata, robots, the
// sitemap, the web manifest and the structured-data block.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://topspin-labs.vercel.app").replace(/\/+$/, "");
export const SITE_NAME = "TopSpin";
export const ORG_NAME = "TopSpin Labs";
export const SITE_DESCRIPTION =
  "Film one stroke and TopSpin reads your form on-device, then predicts your ball " +
  "flight with real drag and Magnus physics. Your footage never leaves your phone.";
