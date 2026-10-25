import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The app's images are private evidence photos behind short-lived
      // signed URLs, blob: previews of a photo being uploaded, and profile
      // avatars. next/image cannot load blob: URLs, and routing the private
      // photos through the image optimizer would cache copies of them on
      // the server, outside Supabase Storage's access rules (and bill for
      // it). Plain <img> it is; list and thumbnail images use
      // loading="lazy" for the bandwidth win instead.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
