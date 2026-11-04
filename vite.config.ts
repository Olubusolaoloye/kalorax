import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Libraries change rarely, so browsers keep this file cached across app releases.
            { name: "vendor", test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|convex|@convex-dev)[\\/]/ },
            // All icons in one file instead of dozens of tiny requests.
            { name: "icons", test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts", "convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
