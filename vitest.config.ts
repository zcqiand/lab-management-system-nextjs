import { defineConfig } from "vitest/config";
import FnReporter from "./tests/fnReporter";

/**
 * vitest 配置。Next.js 项目里两件事必须分开：
 *  1. 排除 .next/、node_modules/，让 vitest 走原生 ESM 解析而不是 next 的编译器
 *  2. 测试默认连 ":memory:" 的 SQLite，避免污染仓库里的 data/dev.db
 *
 * 如果某个测试需要真实磁盘 DB，显式 import @/db 那条路径前，
 * 通过 vi.mock 把路径换成 fixture。
 *
 * `server-only` alias：Next 的 RSC bundler 根据上下文换 server index.js / client empty.js，
 * 但在裸 Node ESM（vitest）里直接执行会 throw。把空模块重定向到 server-only 空 stub。
 */
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".next", "src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    env: {
      DB_PATH: ":memory:",
    },
    reporters: ["default", new FnReporter()],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": fileURLToPath(new URL("./tests/server-only.stub.ts", import.meta.url)),
    },
  },
});
