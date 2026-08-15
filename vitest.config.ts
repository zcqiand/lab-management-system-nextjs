import { defineConfig } from "vitest/config";
import FnReporter from "./tests/fnReporter";

/**
 * vitest 配置。Next.js 项目里两件事必须分开：
 *  1. 排除 .next/、node_modules/，让 vitest 走原生 ESM 解析而不是 next 的编译器
 *  2. 测试默认连 ":memory:" 的 SQLite，避免污染仓库里的 data/dev.db
 *
 * 双环境约定（vitest 4 方式）：`*.dom.test.tsx` / `*.dom.test.ts` 跑 jsdom
 * （组件/页面测试，拿 tests/setup.dom.ts 的 RTL 清理 + msw node server）；
 * 其余维持 node 环境。vitest 4 已移除 environmentMatchGlobs，
 * 用 test.projects 双项目实现同款按文件名分流。
 *
 * `server-only` alias：Next 的 RSC bundler 根据上下文换 server index.js / client empty.js，
 * 但在裸 Node ESM（vitest）里直接执行会 throw。把空模块重定向到 server-only 空 stub。
 */
import { fileURLToPath } from "node:url";

const sharedExclude = ["node_modules", "dist", ".next", "src/**/*.{test,spec}.{ts,tsx}"];
const resolveAlias = {
  "@": new URL("./src", import.meta.url).pathname,
  "server-only": fileURLToPath(new URL("./tests/server-only.stub.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: resolveAlias },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: [...sharedExclude, "tests/**/*.dom.test.{ts,tsx}"],
          setupFiles: ["tests/setup.ts"],
          env: { DB_PATH: ":memory:" },
          testTimeout: 10000,
          // db.smoke 的 beforeAll 要跨网跑 13 个 V*.sql，默认 10s hookTimeout 会掐死
          hookTimeout: 120000,
        },
      },
      {
        resolve: { alias: resolveAlias },
        // tsconfig 的 jsx:"preserve" 是给 next/swc 的；vitest 4（vite 8/rolldown oxc
        // 转译链）不认 preserve——.tsx 里的 JSX 会 "Unexpected JSX expression"。
        // 这里显式给 oxc 转译器 automatic runtime（react/jsx-runtime）。
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/**/*.dom.test.{ts,tsx}"],
          setupFiles: ["tests/setup.ts", "tests/setup.dom.ts"],
          env: { DB_PATH: ":memory:" },
          testTimeout: 10000,
        },
      },
    ],
    reporters: ["default", new FnReporter()],
  },
});
