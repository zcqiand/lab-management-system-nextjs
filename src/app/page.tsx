// infra-only stub。本仓无产品 UI；页面只是为了让 Next.js build 有 root。
// 真的「对外状态」由 /api/health 返回（用 sqlite smoke 那张表做一次写入 + 计数）。

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 font-mono text-sm">
      <h1>lab-management-system-nextjs</h1>
      <p>infra-only: SSOT emit + pg runtime lend. See README + scripts/emit-schema.mjs.</p>
    </main>
  );
}
