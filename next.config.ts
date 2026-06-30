import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright は Node.js ネイティブ依存を含むため、バンドルせず require で読み込む。
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
