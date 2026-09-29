import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the dev server (hot reload) work when opened through a tunnel.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
};

export default nextConfig;
