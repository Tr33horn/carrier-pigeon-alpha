import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // Project rules
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      // Let unused-imports handle it (it can auto-fix by removing imports)
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",

      // ✅ Auto-remove unused imports
      "unused-imports/no-unused-imports": "error",

      // ✅ Warn on unused vars/args, allow underscore-prefixed as intentional
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;