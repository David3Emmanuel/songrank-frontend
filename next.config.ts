import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Covers are served by Spotify's and YouTube's CDNs, which are already
    // sized and cached, so the optimizer buys little. It costs a lot here: it
    // proxies every cover through the Node process, and this machine's Node
    // fetch to i.scdn.co times out in bursts (ETIMEDOUT -> HTTP 500), so covers
    // failed at random while the browser's own request to the same URL would
    // have succeeded. Loading them directly takes Node out of the path.
    unoptimized: true,
    // Kept so the optimizer can be switched back on without re-deriving these.
    remotePatterns: [
      {
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
