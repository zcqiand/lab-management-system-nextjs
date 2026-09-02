// M01.F05.I06 — IUserDirectory (mem-backed, dev only;V014+ 换 DB)。
//
// 镜像 springboot / aspnetcore 的 UserDirectory / IUserDirectory 语义:
// - findByUsername / findByEmail / findById
// - checkPassword (dev password)
// - tenantsOf / defaultTenant / findByTenantId
// - upsert (首次 SSO 落地)
//
// 主键 username：2026-09-02 契约收敛为 alice（与 saas seed V016 同源；四方 msw/nextjs/
// aspnetcore/springboot 统一，contract-test 依赖）。ADR-0008 的 email 主键约定保留给 SSO upsert 路径。
export interface LabUser {
  id: string;
  username: string; // = email (简化映射)
  displayName?: string;
  roleCode?: string;
}

export interface LabTenant {
  tenantId: string;
  code: string;
  name: string;
  roleIds: string[];
}

export interface IUserDirectory {
  findByUsername(username: string): LabUser | null;
  findByEmail(email: string): LabUser | null;
  findById(id: string): LabUser | null;
  checkPassword(username: string, password: string): boolean;
  tenantsOf(username: string): LabTenant[];
  defaultTenant(): LabTenant;
  findByTenantId(tenantId: string): LabTenant | null;
  upsert(id: string, email: string, displayName: string, roleCode: string): LabUser;
}

const DEMO_USER: LabUser = {
  id: "USER-A",
  username: "alice",
  displayName: "管理员",
  roleCode: "admin",
};

const TENANTS: LabTenant[] = [
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

export class ConfigUserDirectory implements IUserDirectory {
  private readonly devPassword: string;
  private readonly upserted: Map<string, LabUser> = new Map();

  constructor(devPassword: string) {
    this.devPassword = devPassword;
  }

  findByUsername(username: string): LabUser | null {
    if (!username) return null;
    if (DEMO_USER.username === username) return DEMO_USER;
    for (const u of this.upserted.values()) {
      if (u.username === username) return u;
    }
    return null;
  }

  findByEmail(email: string): LabUser | null {
    if (!email) return null;
    if (email === DEMO_USER.username) return DEMO_USER;
    for (const u of this.upserted.values()) {
      if (u.username === email) return u;
    }
    return null;
  }

  findById(id: string): LabUser | null {
    if (!id) return null;
    if (id === DEMO_USER.id) return DEMO_USER;
    for (const u of this.upserted.values()) {
      if (u.id === id) return u;
    }
    return null;
  }

  checkPassword(username: string, password: string): boolean {
    return DEMO_USER.username === username && this.devPassword === password;
  }

  tenantsOf(_username: string): LabTenant[] {
    // Noop 单租户实现：_username 不参与 tenant 列表过滤（同一 dev 部署返回固定 TENANTS）。
    void _username;
    return TENANTS;
  }

  defaultTenant(): LabTenant {
    return TENANTS[0]!;
  }

  findByTenantId(tenantId: string): LabTenant | null {
    return TENANTS.find((t) => t.tenantId === tenantId) ?? null;
  }

  upsert(id: string, email: string, displayName: string, roleCode: string): LabUser {
    if (!email) throw new Error("email required for upsert");
    const existing = this.upserted.get(email);
    if (existing) return existing;
    const user: LabUser = {
      id,
      username: email,
      displayName,
      roleCode: roleCode || "viewer",
    };
    this.upserted.set(email, user);
    return user;
  }
}

export const DEMO_TENANTS = TENANTS;
