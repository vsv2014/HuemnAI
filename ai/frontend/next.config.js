/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // For easier deployment
  turbopack: {
    root: __dirname,
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  // If you encounter image optimization issues, uncomment:
  // images: {
  //   unoptimized: true,
  // },
};

module.exports = nextConfig;
