module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      typescript: {},
    },
  },
  extends: [
    "plugin:@typescript-eslint/recommended",
    "prettier/@typescript-eslint",
    "plugin:import/typescript",
  ],
  rules: {
    camelcase: ["off"],
    "@typescript-eslint/camelcase": ["error", { properties: "always" }],
    "@typescript-eslint/no-var-requires": ["off"],
    "@typescript-eslint/explicit-function-return-type": ["off"],
    "@typescript-eslint/no-explicit-any": ["off"],
    "import/no-unresolved": ["off"],
  },
  env: {
    node: true,
    jest: true,
  },
};
