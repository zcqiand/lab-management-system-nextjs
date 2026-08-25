"use client";

// `/` 操作页面：左 AppShell 拉 saas 菜单 + 右「Lab Operational Console」首页。
//
// 守卫：未登录 → 跳 /login（SSO）。已登录 → AppShell。
// 选中的菜单码通过 ?menu=<code> 反映到 URL，菜单点击只换 query 不换路径。

import { useSearchParams } from "next/navigation";
import { useBackendMenus } from "@/components/app/sidebar-nav";
import { useAuth } from "@/state/auth-context";

const APP_CODE = process.env.NEXT_PUBLIC_LAB_APP_CODE ?? "lab-management";

function findByCode(
  tree: Array<{ code: string; children: Array<{ code: string }> }>,
  code: string,
): { code: string } | null {
  for (const n of tree) {
    if (n.code === code) return n;
    const c = findByCode(n.children as never[], code);
    if (c) return c;
  }
  return null;
}

function Dashboard() {
  const sp = useSearchParams();
  const selectedMenu = sp.get("menu");
  const { data: menus } = useBackendMenus();
  const { token } = useAuth();

  const tree = menus ?? [];
  const found = selectedMenu ? findByCode(tree as never[], selectedMenu) : null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Lab Operational Console</h2>
        <p className="text-sm text-slate-500">
          lab-management-system-nextjs 是 lab 家族的 <strong>接线层</strong>： 提供
          SSO（委托 saas 身份平台）、菜单（来自 saas /me/menus 按{" "}
          <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">
            NEXT_PUBLIC_LAB_APP_CODE
          </code>{" "}
          过滤）、4-backend 切换 + API routes。M01..M06 业务页在{" "}
          <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">
            lab-management-system-react
          </code>{" "}
          /{" "}
          <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">
            lab-management-system-vue
          </code>{" "}
          仓。
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold mb-2">环境状态</h3>
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
          <dt className="text-slate-500">NEXT_PUBLIC_LAB_APP_CODE</dt>
          <dd className="font-mono">{APP_CODE}</dd>
          <dt className="text-slate-500">菜单总数（当前 appCode）</dt>
          <dd className="font-mono">{tree.length} 个一级节点</dd>
          <dt className="text-slate-500">token</dt>
          <dd className="font-mono text-xs break-all">{token ?? "（未登录）"}</dd>
        </dl>
      </div>

      {selectedMenu && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold mb-1">选中的菜单</h3>
          <p className="text-sm text-slate-600">
            code: <code className="font-mono">{selectedMenu}</code>
            {found ? " ✓ 在 saas 菜单树里" : "（菜单不在 saas 树里）"}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            业务页（合同 / 接样 / 报告 / M06 检测能力 等）见 lab-management-system-react /
            vue。 本仓 wiring 层不实现具体页（CLAUDE.md §3 禁业务）。
          </p>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Dashboard />;
}
