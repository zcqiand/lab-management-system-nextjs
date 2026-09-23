// M00.F01 当前用户会话 / M00.F02 登录选租户 — 顶栏会话信息 + 租户切换。
//
// 源码级 fnTest（house style，同 auth.dom/m98-wiring 的 data-fn 标记断言）：
//   - M00.F01.I01：AppShell header 挂 user-display-name（displayName 来自 /api/auth/me hydrate）
//   - M00.F02.I01：TenantSwitcher 挂 data-fn + 走 switchTenant（POST /api/auth/switch-tenant 换真 JWT）
// 请求链行为由 sidebar-nav.direct.dom.test.tsx（/me mock 分流）+ m98-wiring（switch-tenant 真 JWT）
// + contract-test auth-write（四方 3 段 JWT 比对）分层锁死，此处不重复。
import { describe, expect } from "vitest";
import { fnTest } from "../fn";

function readSrc(rel: string): Promise<string> {
  return import("node:fs").then((fs) =>
    import("node:path").then((path) =>
      fs.readFileSync(path.resolve(process.cwd(), rel), "utf8"),
    ),
  );
}

describe("M00 顶栏会话信息与租户切换", () => {
  fnTest(
    ["M00.F01.I01"],
    "AppShell header 挂 user-display-name（displayName，/api/auth/me hydrate）",
    async () => {
      const shell = await readSrc("src/components/app/app-shell.tsx");
      expect(shell).toMatch(/data-testid="user-display-name"/);
      expect(shell).toMatch(/data-fn="M00\.F01\.I01"/);
      expect(shell).toMatch(/user\?\.displayName/);
      // 数据源：auth-context 挂 authGetCurrentUser（GET /api/auth/me）hydrate
      const ctx = await readSrc("src/state/auth-context.tsx");
      expect(ctx).toMatch(/authGetCurrentUser/);
    },
  );

  fnTest(
    ["M00.F01.I01"],
    "SSO 真后端 displayName 为空串时回退 username 渲染（空串回退回归锁）",
    async () => {
      // 2026-09-23 现场：saas sys_user 无显示名列 → /me 不带 displayName →
      // aspnetcore SsoCallback Upsert 存 ""（且 FindByEmail 命中后不再更新）→
      // 前端 ?? 对 "" 不触发回退 → 顶栏「租户旁用户名」渲染成空白。
      // 链路必须用 ||（displayName 空串 → username → 占位），?? 只兜 null/undefined。
      const shell = await readSrc("src/components/app/app-shell.tsx");
      expect(shell).toMatch(/user\?\.displayName \|\| user\?\.username/);
      // 同款写库陷阱：receivedBy 是收样单落库字段，空串会污染数据面
      const modal = await readSrc("src/features/receipts/ReceiptFormModal.tsx");
      expect(modal).toMatch(/currentUser\?\.displayName \|\| currentUser\?\.username/);
    },
  );

  fnTest(
    ["M00.F02.I01"],
    "TenantSwitcher 挂 data-fn + 登出左侧渲染 + switchTenant 换 token",
    async () => {
      const switcher = await readSrc("src/components/app/tenant-switcher.tsx");
      expect(switcher).toMatch(/data-fn="M00\.F02\.I01"/);
      expect(switcher).toMatch(/data-testid="tenant-switcher"/);
      expect(switcher).toMatch(/switchTenant/);
      // 上下文：switchTenant 走 authSwitchTenant（POST /api/auth/switch-tenant）
      const ctx = await readSrc("src/state/auth-context.tsx");
      expect(ctx).toMatch(/authSwitchTenant/);
      // 接线：AppShell 在登出按钮旁渲染 TenantSwitcher
      const shell = await readSrc("src/components/app/app-shell.tsx");
      expect(shell).toMatch(/<TenantSwitcher \/>/);
    },
  );
});
