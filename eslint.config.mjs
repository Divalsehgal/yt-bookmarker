import js from "@eslint/js";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { chrome: "readonly" }
    },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "separate-type-imports"
      }],
      "@typescript-eslint/member-ordering": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/sort-type-constituents": "error",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error"
    }
  }
);
