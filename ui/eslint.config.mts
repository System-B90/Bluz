import nextConfig from "eslint-config-next/core-web-vitals";
import { defineConfig } from "eslint/config";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig([
  nextConfig,
  {
    settings: {
      next: {
        rootDir: "ui/",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    ignores: [ ".next/*", "out/*", "dist/*" ],
  }
]);