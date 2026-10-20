// POST /api/auth/switch-tenant — body { tenantId }
// 校验 tenantId 属于已知列表后返回新 token。
//
// ADR-0019：删「无 Bearer = 切到 demo USER-A」反模式。必须先有 Bearer 才能切租户。
// 2026-09-14 对齐 login route：签真 HS256 token（LabJwtSigner + readLabConfig），
// 不再用 mock-jwt-tenant-${tid} opaque token——那会让 subFromBearer 解不出 sub，
// 切完租户下一请求即 401 断会话。响应 shape 不变（contract-test 同步增强断言）。

import { NextResponse } from "next/server";
import { subFromBearer } from "@/lib/auth/bearer";
import { LabJwtSigner } from "@/lib/auth/jwt";
import { readLabConfig } from "@/lib/auth/factory";
import { getMembershipSnapshot } from "@/lib/auth/membership-snapshot";
import { getUserSnapshot } from "@/lib/auth/user-snapshot";

const DEMO_TENANTS = [
  {
    tenantId: "TENANT-001",
    code: "city-lab",
    name: "市住建工程质量检测中心",
    roleIds: ["admin"],
  },
  {
    tenantId: "TENANT-002",
    code: "district-lab",
    name: "区检测站",
    roleIds: ["technician"],
  },
  {
    tenantId: "TENANT-003",
    code: "third-party",
    name: "第三方检测实验室",
    roleIds: ["viewer"],
  },
];

export async function POST(req: Request) {
  // ADR-0019：未登录态直打 = 401
  const sub = subFromBearer(req.headers.get("authorization"));
  if (sub === null) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Bearer token required (ADR-0019)" },
      { status: 401 },
    );
  }
  // 2026-10-21 ADR-0019 收口（镜像 rails resolve_user：身份解析在前）——user
  // 来自 user 快照（login/sso/callback 写入），miss 401；写死「alice/管理员」
  // 字面量是「业务身份字段兜底到 demo 字面量」反模式。
  const user = getUserSnapshot(sub);
  if (!user) {
    return NextResponse.json(
      {
        code: "USER_UNAVAILABLE",
        message: `user snapshot unavailable for user ${sub}; re-login to recover`,
      },
      { status: 401 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { tenantId?: string };
  const tid = String(body.tenantId ?? "");
  if (!tid) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "tenantId is required" },
      { status: 400 },
    );
  }
  // REQ-2026-023 live 实证（2026-10-11）：登录会话的租户体系是 saas（membership
  // snapshot，login/sso/callback 写入；tenant_id claim=saas currentTenantId），
  // 归属校验必须对着用户当前租户集——写死 DEMO_TENANTS 会让密码登录用户切
  // 登录响应里的租户 404。快照 miss（重启/TTL 过期）降级 demo 列表兜底。
  const knownTenants = getMembershipSnapshot(sub) ?? DEMO_TENANTS;
  const target = knownTenants.find((t) => t.tenantId === tid);
  if (!target) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Tenant not found" },
      { status: 404 },
    );
  }
  // 真 HS256（ADR-0019 禁 opaque mock token 兜底）：缺失密钥即 throw → 500 fail-fast。
  const labCfg = readLabConfig();
  const signer = new LabJwtSigner(
    labCfg.jwt.secret,
    labCfg.jwt.issuer,
    labCfg.jwt.ttlSeconds,
    labCfg.jwt.refreshTtlSeconds,
  );
  return NextResponse.json({
    token: signer.issue(sub, tid),
    refreshToken: signer.issueRefresh(sub, "dev-refresh-token-placeholder"),
    user,
    tenants: knownTenants,
  });
}
