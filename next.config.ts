import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allows the dev server to be reached from another device on the LAN
  // (useful for testing the webcam page on a phone). Dev only — has no
  // effect on a production build.
  allowedDevOrigins: ['192.168.1.2'],
}

export default nextConfig
