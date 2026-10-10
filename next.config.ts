import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Allow the dev server to work through a tunnel.
	allowedDevOrigins: [
		"*.ngrok-free.dev",
		"*.ngrok-free.app",
		"*.ngrok.app",
		"*.ngrok.io",
	],
};

export default nextConfig;
