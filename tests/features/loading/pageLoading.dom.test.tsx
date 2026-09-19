// 内容区加载态（B6 批）—— 页面数据未到齐前整页 PageLoading，不渲染空壳。
//
// 工程设施测试：不挂 fn ID（fn.ts 纪律）。网络全 mock（msw node server +
// delay('infinite') 制造 pending），不连真后端：
//   - pending：断言 data-testid="page-loading" 在场、页面真实内容不可见
//   - resolve（resetHandlers 后重挂载）：内容可见、加载态消失
//   - SummaryPage 聚合：三个数据源（report-names/stats/summary）任一未到仍整页
//     加载，全部到齐才显示
import { describe, it, expect, afterEach } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../setup.dom";

function mountWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function pendingGet(url: string) {
  return http.get(url, async () => {
    await delay("infinite");
    return HttpResponse.json({}, { status: 200 });
  });
}

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

describe("页面级加载态（PageLoading 门控）", () => {
  it("PageLoading 组件渲染加载标记（testid + 文案）", async () => {
    const { PageLoading } = await import("@/components/app/page-loading");
    render(<PageLoading />);
    expect(screen.getByTestId("page-loading")).toBeInTheDocument();
    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  it("ContractsPage：fetch pending 时整页加载态，空表壳不先渲染；resolve 后内容可见", async () => {
    // RED（改前）：壳（标题/表头）先渲染，且没有整页加载标记
    server.use(pendingGet("*/api/contracts"));
    const { default: ContractsPage } = await import("@/app/(console)/contracts/page");
    mountWithQuery(<ContractsPage />);
    await waitFor(
      () => {
        expect(screen.getByTestId("page-loading")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText("合同管理")).not.toBeInTheDocument();
    expect(screen.queryByText("合同编号")).not.toBeInTheDocument();

    // resolve：撤掉 pending 覆盖 → 重挂载走默认 msw handlers → 内容可见
    cleanup();
    server.resetHandlers();
    mountWithQuery(<ContractsPage />);
    await waitFor(
      () => {
        expect(screen.getByText("合同管理")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByTestId("page-loading")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("合同编号").length).toBeGreaterThan(0);
    });
  });

  it("SummaryPage：三个数据源任一未到即整页加载态，全部到齐才显示界面", async () => {
    // report-names 悬挂，stats/summary 正常回来 —— 1 源未到仍整页加载
    server.use(pendingGet("*/api/report-names"));
    const { SummaryPage } = await import("@/features/summary/SummaryPage");
    mountWithQuery(<SummaryPage />);
    await waitFor(
      () => {
        expect(screen.getByTestId("page-loading")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText("核心指标")).not.toBeInTheDocument();

    // 三源全部到齐（resetHandlers 后重挂载走默认 handlers）→ 内容可见
    cleanup();
    server.resetHandlers();
    mountWithQuery(<SummaryPage />);
    await waitFor(
      () => {
        expect(screen.getByText("核心指标")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByTestId("page-loading")).not.toBeInTheDocument();
  });
});
