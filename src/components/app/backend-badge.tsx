// 后端模式标签（无交互）— 替代 BackendSwitcher（已废弃 — ADR-0014）。
//
// 显示当前 apiMode（来自 NEXT_PUBLIC_API_MODE，部署期 env），仅用于诊断。
// 不控路由、纯展示（旧 BackendSwitcher 的 M98.F01.I01 锚点随旧组件废弃后，
// 由本组件接替 —— 2026-08-29 lab-nextjs 跟齐 lab-react reference 时恢复）。

import { getApiBaseUrl, getApiMode } from "@/api/backend-config";

export function BackendBadge() {
  const mode = getApiMode();
  const baseUrl = getApiBaseUrl() || "(同源)";
  return (
    <div className="border rounded p-2 text-sm bg-white text-slate-900" data-fn="M98.F01.I01">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs">backend:</span>
        <strong data-testid="backend-badge">{mode}</strong>
      </div>
      <div className="mt-1 font-mono text-xs text-gray-500 truncate" title={baseUrl}>
        {baseUrl}
      </div>
    </div>
  );
}