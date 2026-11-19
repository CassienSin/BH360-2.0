import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The "N" route badge exists only in `next dev`; it covered the phone tab
  // bar in design screenshots. Build and runtime errors still show.
  devIndicators: false,
};

export default nextConfig;
