// 后端切换器（2026-09-14 用户裁定恢复运行时切换，对齐 saas backend-badge）。
// 选择持久化 localStorage（lab.api.backend），http-client 每请求动态读取，
// 切完下一请求即生效，无需刷新。未选择 = env 默认目标。
// variant="sidebar"：深色侧边栏 footer 用白字样式；variant="plain"：浅色背景默认 ghost。
"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SELECTABLE_BACKENDS,
  getSelectedBackend,
  resolveSelectedBackendUrl,
  setSelectedBackend,
} from "@/api/backend-config";

export function BackendBadge({ variant = "sidebar" }: { variant?: "sidebar" | "plain" }) {
  const [selected, setSelected] = useState(getSelectedBackend());
  const current = SELECTABLE_BACKENDS.find((b) => b.key === selected);

  function pick(key: string) {
    setSelectedBackend(key);
    setSelected(key);
  }

  return (
    <div
      className={variant === "sidebar" ? "w-full px-2 py-1 text-xs" : "w-full text-xs"}
      data-testid="backend-badge"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={
              variant === "sidebar"
                ? "w-full justify-between gap-2 border border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
                : "w-full justify-between gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }
          >
            <span className="flex min-w-0 items-center gap-2">
              <Server className="h-4 w-4 text-slate-500" />
              <span className="truncate font-medium">{current ? current.key : "(env 默认)"}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>切换后端</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => pick("")} className="cursor-pointer">
            <Server className="mr-2 h-4 w-4 text-slate-400" />
            <span className="flex-1">env 默认（部署配置）</span>
            {!selected && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
          {SELECTABLE_BACKENDS.map((b) => (
            <DropdownMenuItem
              key={b.key}
              onSelect={() => pick(b.key)}
              className="cursor-pointer"
            >
              <Server className="mr-2 h-4 w-4 text-slate-500" />
              <div className="flex flex-1 flex-col">
                <span className="font-medium">{b.key}</span>
                <span className="font-mono text-xs text-slate-500">
                  {resolveSelectedBackendUrl(b.key)}
                </span>
              </div>
              {selected === b.key && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
