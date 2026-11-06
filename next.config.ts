import type { NextConfig } from "next";
import os from "os";

const getLocalIPs = (): string[] => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const networkInterface = interfaces[name];
    if (networkInterface) {
      for (const net of networkInterface) {
        if (net.family === "IPv4" && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  return ips;
};

const localIPs = getLocalIPs();

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    "localhost:3000",
    "http://localhost:3000",
    ...localIPs.map((ip) => `${ip}:3000`),
    ...localIPs.map((ip) => `http://${ip}:3000`),
    ...localIPs,
  ],
};

export default nextConfig;
