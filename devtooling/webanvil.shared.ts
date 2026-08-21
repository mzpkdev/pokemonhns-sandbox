import type { UserConfig } from "webanvil"

export const codeStyle = {
  format: {
    semi: false,
  },
  lint: {
    rules: {
      "func-style": ["error", "declaration", { allowArrowFunctions: false }],
      "typescript/consistent-type-definitions": ["error", "type"],
    },
  },
} satisfies Pick<UserConfig, "format" | "lint">
