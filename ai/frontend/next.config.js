/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // For easier deployment
  // Disable turbopack in production build for stability if needed, 
  // though config structure here keeps it optional.
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Ignore typescript/eslint errors during build to save memory and prevent build failure on trivial issues
  // These should be checked in CI/CD pipeline instead
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Optimize image handling
  images: {
    unoptimized: true, // Often helps in Docker/VPS environments if image optimization service isn't set up
  },
  
  // Webpack config to minimize memory usage
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    }
    return config
  },
};

module.exports = nextConfig;
