import os from 'os';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    staleTimes: {
      static: 86400,
      dynamic: 30,
    },
    workerThreads: true,
    cpus: Math.max(1, (Number(process.env.NEXT_WORKER_CPU_PERCENT || 50) / 100) * os.cpus().length),
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
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      aggregateTimeout: 300,
      poll: 1000,
    };
    
    config.optimization = {
      ...config.optimization,
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test: /[\\/]node_modules[\\/]/,
            priority: 30,
            minChunks: 2,
            name(module) {
              const match = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
              if (!match) return `vendor-unknown`;
              
              const packageName = match[1].replace('@', '');
              return `vendor-${packageName}`;
            },
          },
        },
      },
    };
    
    return config;
  },
};

export default nextConfig;
