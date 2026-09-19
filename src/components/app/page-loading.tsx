import { Loader2 } from "lucide-react";

// PageLoading — 页面级加载态（B6 批：内容区数据未到齐前的整页占位）。
//
// 用户需求：点击菜单后，右内容区在数据加载完成前显示「加载中」，禁止空表壳先渲染。
// 形态 = Loader2 spinner（对齐 app-shell.tsx MenuStatusBanner 的 Loader2 用法）
// + 「加载中…」居中块。controller ruling：不做骨架屏；已有 per-widget「加载中…」
// 保留（refetch 时仍有意义）。
export function PageLoading() {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 text-slate-500"
      data-testid="page-loading"
      role="status"
    >
      <Loader2 className="mb-3 h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="text-sm">加载中…</span>
    </div>
  );
}
