"use client";

// 租户切换器（M00.F02.I01，视觉对齐 saas tenant-switcher：DropdownMenu + Building2 + ChevronsUpDown）。
// 数据来自 auth-context（GET /api/auth/me hydrate 的 tenants + currentTenantId），
// 切换走 POST /api/auth/switch-tenant → 换发新 tenant claim 的真 HS256 token，会话不中断。

import { Building2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/state/auth-context";
import { toApiError } from "@/api/http-client";
import { toast } from "sonner";

export function TenantSwitcher() {
  const { tenants, currentTenantId, switchTenant } = useAuth();
  const current = tenants.find((t) => t.tenantId === currentTenantId);

  async function onSwitch(tenantId: string) {
    try {
      await switchTenant(tenantId);
    } catch (err) {
      const apiErr = toApiError(err);
      toast.error(
        apiErr.status === 404
          ? "该租户不存在或你不是其成员"
          : `切换失败：${apiErr.message}`,
      );
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="tenant-switcher"
          data-fn="M00.F02.I01"
        >
          <Building2 className="h-4 w-4 text-slate-500" />
          <span className="font-medium">{current ? current.name : "选择租户"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>切换租户</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.tenantId}
            onSelect={() => void onSwitch(t.tenantId)}
            className="cursor-pointer"
          >
            <Building2 className="h-4 w-4 mr-2 text-slate-500" />
            <div className="flex flex-col">
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-slate-500 font-mono">{t.code}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
