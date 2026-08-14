import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Next.js 项目的 eslint 配置。
 *
 * 与 react-ts 的差异：
 *  - 增加 next 推荐的 no-html-link-for-pages、@next/next/no-img-element
 *  - 客户端组件必须显式标注：team 约定用 file 级别的 'use client'，不能用 no-jsx-comment-to-jsx
 *    判不出时（动态 require() 等）就靠 code review
 *
 * 提示词里的禁令靠自觉，eslint 里的禁令靠 exit code。重要的约束要落在这里。
 */
export default tseslint.config(
  { ignores: [".next", "node_modules", "coverage", "dist"] },
  ...tseslint.configs.recommended,
  {
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      // 项目 CLAUDE.md 的硬约束
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",

      // rerender-no-inline-components
      "react/no-unstable-nested-components": "error",

      // rerender-dependencies / advanced-effect-event-deps
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      // bundle-barrel-imports：直接导入，别走 barrel
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/index", "**/index.ts", "**/index.tsx"],
              message:
                "bundle-barrel-imports: 直接导入具体模块，barrel 文件会把整个目录拖进 bundle。",
            },
            {
              group: ["lodash", "@mui/icons-material", "date-fns"],
              message:
                "bundle-barrel-imports: 从子路径导入，如 lodash/debounce。",
            },
          ],
        },
      ],

      // 防止 client 组件意外引入 server-only 模块
      "no-restricted-imports": "off", // 上面已经声明；这里明确关掉避免歧义
      "no-restricted-syntax": [
        "error",
        {
          // 设计与 react-ts 一致：禁止裸 hex
          selector: "Literal[value=/-\\[#[0-9a-fA-F]{3,8}\\]/]",
          message:
            "design-tokens-only: 禁止裸 hex 颜色（如 bg-[#3b82f6]）。用 globals.css 的语义 token：bg-primary / text-muted-foreground / border-input 等。",
        },
        {
          selector: "Literal[value=/\\b(rgb|rgba|hsl|hsla)\\(/]",
          message:
            "design-tokens-only: 禁止行内 rgb/hsl 颜色。用 globals.css 的语义 token，或在 globals.css 新增 token。",
        },
      ],
    },
  },
  {
    // 适配器与配置文件不受业务规则约束，但仍禁 any
    files: [
      "tests/fnReporter.ts",
      "tests/fn.ts",
      "tests/setup.ts",
      "vitest.config.ts",
      "next.config.ts",
    ],
    rules: { "react-hooks/exhaustive-deps": "off" },
  },
);
