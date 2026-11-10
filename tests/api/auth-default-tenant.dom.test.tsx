// M00.F02.I01 — 登录后默认选中一个租户（SSO 裸 token 租户错位回归，2026-11-10）。
//
// 现场：SSO 回调存的 token 是 saas 原生 token（tenant_id claim = saas 租户 UUID），
// 而数据种子全挂 tenant key（acme 等）→ 租户过滤后全空、无报错。
// 裁定：登录后前端默认选中租户列表第一个，走既有 switch-tenant 换铸 keyed token。
//
// 行为测试（vi.mock 端点模块，同 login-page-sso.dom 范式）：
//   1. /me 返回 currentTenantId ∉ tenants（SSO 裸 token 形状）→ 自动 switchTenant(首租户)
//   2. /me 返回 currentTenantId ∈ tenants（密码登录 keyed token 形状）→ 不自动切换
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/state/auth-context";

const { meMock, switchMock } = vi.hoisted(() => ({
  meMock: vi.fn(),
  switchMock: vi.fn(),
}));

vi.mock("@/api/endpoints/auth/auth", () => ({
  authGetCurrentUser: meMock,
  authSwitchTenant: switchMock,
}));

function Probe() {
  const { currentTenantId, token } = useAuth();
  return <div data-testid="probe">{`${currentTenantId ?? ""}|${token ?? ""}`}</div>;
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const TENANTS = [
  { tenantId: "acme", tenantName: "市住建工程质量检测中心", role: "admin" },
  { tenantId: "beta", tenantName: "区检测站", role: "member" },
];
const USER = { id: "00000000-0000-0000-0000-b000000000001", username: "alice" };
const SSO_UUID = "00000000-0000-0000-0000-000000000001";

describe("登录后默认选中一个租户（M00.F02.I01 消费面）", () => {
  beforeEach(() => {
    meMock.mockReset();
    switchMock.mockReset();
    localStorage.setItem("lab.token", "saas-raw-token");
  });

  it("SSO 裸 token（currentTenantId ∉ tenants）→ 自动切首租户换铸 keyed token", async () => {
    meMock.mockResolvedValue({
      user: USER,
      tenants: TENANTS,
      currentTenantId: SSO_UUID,
    });
    switchMock.mockResolvedValue({
      token: "lab-keyed-token",
      user: USER,
      tenants: TENANTS,
    });

    renderAuth();

    await waitFor(() => {
      expect(switchMock).toHaveBeenCalledTimes(1);
    });
    expect(switchMock).toHaveBeenCalledWith(
      { tenantId: "acme" },
      expect.objectContaining({ headers: expect.anything() }),
    );
    // 换铸后会话身份落首租户，后续请求即带 keyed token
    await waitFor(() => {
      expect(document.querySelector('[data-testid="probe"]')!.textContent).toBe(
        "acme|lab-keyed-token",
      );
    });
  });

  it("keyed token（currentTenantId ∈ tenants）→ 不自动切换", async () => {
    meMock.mockResolvedValue({
      user: USER,
      tenants: TENANTS,
      currentTenantId: "acme",
    });

    renderAuth();

    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(1);
    });
    // 给潜在的误触发留时间窗
    await new Promise((r) => setTimeout(r, 50));
    expect(switchMock).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="probe"]')!.textContent).toBe(
      "acme|saas-raw-token",
    );
  });
});
