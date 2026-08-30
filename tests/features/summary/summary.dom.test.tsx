// M05.F01.I01 — 试验报告汇总表 fnTest
//
// 验证 SummaryPage：
//   1) data-fn=M05.F01.I01 锚点
//   2) 默认 ALL 时拉 /api/summary → 表格有行
//   3) 切换 categoryCode=RN-101 → 表格重新渲染
import { describe, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SummaryPage } from "@/features/summary/SummaryPage";
import { fnTest } from "../../fn";

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SummaryPage />
    </QueryClientProvider>,
  );
}

describe("M05.F01 试验报告汇总表", () => {
  fnTest(
    ["M05.F01.I02"],
    "data-fn=M05.F01.I02 锚点存在（仪表盘统计容器 = 报告类别筛选栏）",
    async () => {
      const { container } = mount();
      const root = container.querySelector('[data-fn="M05.F01.I02"]');
      expect(root).not.toBeNull();
    },
  );

  fnTest(
    ["M05.F01.I01"],
    "data-fn=M05.F01.I01 锚点 + 默认 ALL 拉表格有行",
    async () => {
      const { container } = mount();
      const root = container.querySelector('[data-fn="M05.F01.I01"]');
      expect(root).not.toBeNull();
      // 等 /api/summary 拉回
      await waitFor(() => {
        expect(screen.getByTestId("summary-table")).toBeInTheDocument();
      });
      const table = screen.getByTestId("summary-table");
      // 表格应至少有一行（种子数据有 sampleReceipts）
      const rows = table.querySelectorAll("tbody tr");
      expect(rows.length).toBeGreaterThan(0);
    },
  );

  fnTest(
    ["M05.F01.I01"],
    "切换 categoryCode=RN-101 → 表格重新渲染（MSW 返回水泥行）",
    async () => {
      mount();
      // 等下拉填充完毕
      const select = await waitFor(
        () => {
          const s = screen.getByTestId("summary-category-select") as HTMLSelectElement;
          const opts = Array.from(s.querySelectorAll("option")).map((o) => o.value);
          expect(opts).toContain("RN-101");
          return s;
        },
        { timeout: 3000 },
      );
      fireEvent.change(select, { target: { value: "RN-101" } });
      // 等 summary 拉回 — backend 返回水泥行 + summaryName「水泥试验报告汇总表」
      await waitFor(() => {
        const headers = screen.getAllByText(/水泥试验报告汇总表/);
        expect(headers.length).toBeGreaterThan(0);
      });
    },
  );
});