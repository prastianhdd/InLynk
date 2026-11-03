import type { NextConfig } from 'next';
const apiServer = process.env.INLYNK_API_SERVER === '1';
const config: NextConfig = {
  distDir: apiServer ? '.next-api' : '.next',
  async rewrites() {
    return apiServer || process.env.NODE_ENV === 'production' ? [] : { beforeFiles: [{ source: '/api/:path*', destination: `http://127.0.0.1:${process.env.API_PORT || 3001}/api/:path*` }], afterFiles: [], fallback: [] };
  }
};
export default config;
