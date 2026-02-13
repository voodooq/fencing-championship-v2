/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true,
  images: {
    domains: ["yyfencing.oss-cn-beijing.aliyuncs.com"],
  },
}

module.exports = nextConfig
