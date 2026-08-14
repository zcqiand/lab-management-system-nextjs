/**
 * jsdom 环境专属 setup：RTL 清理 + msw node server 生命周期。
 * vitest environmentMatchGlobs 命中 jsdom 的测试（*.dom.test.tsx / *.dom.test.ts）
 * 才会真正用到这里的 window；node 环境测试同样会执行本文件 ——
 * 所以必须先判 `typeof window !== "undefined"` 再装 jsdom 专属逻辑。
 */
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";

/** msw v2 setupServer 返回类型的窄接口（避免本仓对 msw 产类型硬依赖）。 */
interface NodeMockServer {
  listen(options: { onUnhandledRequest: "error" | "warn" | "bypass" }): void;
  resetHandlers(): void;
  close(): void;
}

const isDom = typeof window !== "undefined";
let server: NodeMockServer | null = null;

if (isDom) {
  beforeAll(async () => {
    const { setupNodeMocks } = await import("@lab/management-system-msw/node");
    server = setupNodeMocks() as unknown as NodeMockServer;
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server?.resetHandlers();
    localStorage.clear();
    cleanup();
  });
  afterAll(() => {
    server?.close();
  });
}
