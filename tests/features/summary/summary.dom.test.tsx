// M05.F01 fnTest — SummaryPage 仪表盘 + 汇总表
//
// 验证 SummaryPage：
//   I02 仪表盘容器锚点
//   I03 核心指标卡（3 个 metric card + 各 detail）
//   I04 任务状态漏斗（6 段）
//   I01 汇总表（原行为：默认 ALL + 切换 categoryCode）
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

describe("M05.F01 试验报告汇总表 + 仪表盘", () => {
  fnTest(
    ["M05.F01.I02"],
    "data-fn=M05.F01.I02 锚点存在（仪表盘容器，包裹 I03/I04/I01 三区块）",
    async () => {
      const { container } = mount();
      const root = container.querySelector('[data-fn="M05.F01.I02"]');
      expect(root).not.toBeNull();
    },
  );

  fnTest(
    ["M05.F01.I03"],
    "data-fn=M05.F01.I03 锚点 + 3 张核心指标卡（今日试验/报告产出/合格率）",
    async () => {
      mount();
      const section = await waitFor(() => {
        const el = document.querySelector('[data-fn="M05.F01.I03"]');
        expect(el).not.toBeNull();
        return el as HTMLElement;
      });
      expect(section.textContent).toContain("核心指标");
      // 3 张卡片
      expect(screen.getByTestId("metric-today-tests")).toBeInTheDocument();
      expect(screen.getByTestId("metric-output")).toBeInTheDocument();
      expect(screen.getByTestId("metric-qualified-rate")).toBeInTheDocument();
      // 等 stats 拉回后，detail 子节点出现
      await waitFor(() => {
        expect(screen.getByTestId("metric-output-detail")).toBeInTheDocument();
      });
      expect(screen.getByTestId("metric-output-detail").textContent).toContain("已签发");
      expect(screen.getByTestId("metric-qualified-detail")).toBeInTheDocument();
    },
  );

  fnTest(
    ["M05.F01.I04"],
    "data-fn=M05.F01.I04 锚点 + 6 段任务状态漏斗",
    async () => {
      mount();
      const section = await waitFor(() => {
        const el = document.querySelector('[data-fn="M05.F01.I04"]');
        expect(el).not.toBeNull();
        return el as HTMLElement;
      });
      expect(section.textContent).toContain("试验任务状态");
      // 等 stats 拉回
      await waitFor(() => {
        expect(screen.getByTestId("funnel-bars")).toBeInTheDocument();
      });
      // 6 段全部渲染
      const stages = [
        "pending_collect",
        "received",
        "testing",
        "reporting",
        "reviewing",
        "issued",
      ];
      for (const s of stages) {
        expect(screen.getByTestId(`funnel-stage-${s}`)).toBeInTheDocument();
      }
      // 漏斗容器显示中文标签
      const funnelEl = screen.getByTestId("funnel-bars");
      expect(funnelEl.textContent).toContain("待取样");
      expect(funnelEl.textContent).toContain("已收样");
      expect(funnelEl.textContent).toContain("试验中");
      expect(funnelEl.textContent).toContain("报告编制");
      expect(funnelEl.textContent).toContain("待审核");
      expect(funnelEl.textContent).toContain("已签发");
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