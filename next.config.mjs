/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
  serverExternalPackages: ["@node-rs/argon2"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/*`,
      },
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/f/*",
      },
      {
        protocol: "https",
        hostname: "t8x8bguwl4.ufs.sh",
        pathname: `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/*`,
      },
      {
        protocol: "https",
        hostname: "t8x8bguwl4.ufs.sh",
        pathname: "/a/t8x8bguwl4/*",
      },
      {
        protocol: "https",
        hostname: "t8x8bguwl4.ufs.sh",
        pathname: "/f/*",
      },
      {
        protocol: "https",
        hostname: "cdn.uploadthing.com",
        pathname: "/f/*",
      },
    ],
  },
  rewrites: () => {
    return [
      {
        source: "/hashtag/:tag",
        destination: "/search?q=%23:tag",
      },
    ];
  },
};

export default nextConfig;
