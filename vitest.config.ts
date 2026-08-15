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
        // node 环境的纯逻辑测试也可能 import .tsx 组件源文件（如
        // concretePermeability.test.ts → ConcretePermeabilityCard.tsx 取纯函数），
        // 同样需要 oxc JSX 转译（与 jsdom project 同款，见下）。
        // 必须放 project 级（test 外层）——vitest 4 每个 project 自建 vite server。
        oxc: { jsx: { runtime: "automatic" } },
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
        // jsdom project 需要自己的 oxc 声明：vitest 4 组装 project vite server 时
        // 只从顶层 oxc 转发 `{ target }`（jsx 字段会被 cli-api 重建覆盖丢掉），
        // project 级的 oxc 才会进该 project 的 vite:oxc transform 插件。
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
