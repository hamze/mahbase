/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Django routes end with "/": keep /api/… and /media/… paths exactly as requested (see lib/backend-proxy.js).
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
