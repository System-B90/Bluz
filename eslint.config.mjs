// __eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath( import.meta.url );
const __dirname = dirname( __filename );

console.log( "ESLint config loaded from:", __dirname );

// Create the FlatCompat helper to convert classic configs
const compat = new FlatCompat( {
  baseDirectory: __dirname,
} );

console.log( "ESLint FlatCompat initialized with baseDirectory:", compat.baseDirectory );
// Export the ESLint configuration
export default [
  // Ignore the .next build folder
  { ignores: [ ".next/**", "node_modules/**", "dist/**", "build/**" ] },

  // Extend Next.js core rules (classic config converted for Flat)
  ...compat.extends(),

  // Custom rules
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",  // disable globally
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
