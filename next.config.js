/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: { serverComponentsExternalPackages: ["xlsx"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // stops the app being embedded in an iframe elsewhere (clickjacking)
          { key: "X-Content-Type-Options", value: "nosniff" }, // stops the browser guessing content types in a way that can be exploited
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;