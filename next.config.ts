import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Allow accessing the dev server from other devices on the LAN (e.g. a phone
  // at http://192.168.1.4:3000). Without this, Next 15.3+/16 blocks the
  // internal /_next/* requests for non-trusted origins, which breaks lazily
  // loaded icon chunks and the image optimizer in development.
  allowedDevOrigins: ["192.168.1.4"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
