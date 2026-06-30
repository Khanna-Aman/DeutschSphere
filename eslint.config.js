// ESLint flat config (advisory). Runtime stays zero-dependency; ESLint is dev-only.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["tailwind.css", "fonts/**", "scripts/**", "**/*.min.js", "lottie/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    rules: {
      // Keep advisory and low-noise on an existing codebase; tighten over time.
      "no-unused-vars": "warn",
      "no-empty": "warn",
      "no-constant-condition": ["warn", { checkLoops: false }],
    },
  },
];
