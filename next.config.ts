import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.js",
  swDest: "public/sw.js",
  compileSrc: false,
  injectionPoint: "serviceWorkerGlobal.__SW_MANIFEST",
  swUrl: "/sw.js",
  scope: "/",
  register: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV !== "production",
  globPublicPatterns: ["**/*.{ico,json,png,svg}"],
});

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
};

export default withSerwist(withNextIntl(nextConfig));
