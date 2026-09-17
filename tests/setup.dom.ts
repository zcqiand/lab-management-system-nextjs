/**
 * jsdom 环境专属 setup：RTL 清理 + msw node server 生命周期。
 * vitest environmentMatchGlobs 命中 jsdom 的测试（*.dom.test.tsx / *.dom.test.ts）
 * 才会真正用到这里的 window；node 环境测试同样会执行本文件 ——
 * 所以必须先判 `typeof window !== "undefined"` 再装 jsdom 专属逻辑。
 */
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * msw v2 setupServer 返回类型的窄接口（避免本仓对 msw 产类型硬依赖）。
 * 扩展 use()：测试用 server.use(...) 覆盖 handler（REF tests/setup.ts 同款能力）。
 */
interface NodeMockServer {
  listen(options: { onUnhandledRequest: "error" | "warn" | "bypass" }): void;
  resetHandlers(): void;
  close(): void;
  use(...handlers: unknown[]): void;
}

const isDom = typeof window !== "undefined";
// 类型上声明非空：只有 .dom.test.*（jsdom）真正消费 server；node 环境下
// 模块仍会加载但没人 import 它——用 `server!` 收窄，测试侧免判空。
let serverRef: NodeMockServer | null = null;

if (isDom) {
  beforeAll(async () => {
    const { setupNodeMocks } = await import("@lab/management-system-msw/node");
    serverRef = setupNodeMocks() as unknown as NodeMockServer;
    serverRef.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    serverRef?.resetHandlers();
    localStorage.clear();
    cleanup();
  });
  afterAll(() => {
    serverRef?.close();
  });
}

/**
 * 暴露 server 单例供测试文件 import（`import { server } from '../setup.dom'` 风格）：
 * seedX 适配层 / server.use(...) per-test 覆盖都拿同一实例。
 *
 * 实现说明：beforeAll 之前 serverRef 还是 null，直接 `export const server = serverRef`
 * 会把 null 固化出去。这里导出一个**透传 proxy**——属性访问/方法调用转发到
 * serverRef 的当前值，测试体（beforeAll 之后）访问时一定已就绪。
 * node 环境（无 window）下访问会 throw，但只有 .dom.test.* 消费。
 */
const server: NodeMockServer = new Proxy({} as NodeMockServer, {
  get(_t, prop, receiver) {
    const target = serverRef as unknown as Record<string | symbol, unknown> | null
    if (!target) {
      throw new Error(
        `tests/setup.dom.ts: server.${String(prop)} 在 beforeAll 之前被访问（server 尚未 listen）。`,
      )
    }
    return Reflect.get(target, prop, receiver)
  },
});
export { server };
