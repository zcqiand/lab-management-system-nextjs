// REF tests/features/inspection-capability/reportNameListAggregation.test.tsx 移植。
// 差异：
// - MemoryRouter 去除（组件不走路由，直接 render）；
// - server/setup 引用改本仓路径（../../setup.dom）；
// - REF 的 seedMasterDataIntoMockDb + seedReportNames 替换为本仓范本模式：
//   resetFixtures()（msw seeds 即同一份 generated 报告名称/关联数据，快照恢复）
//   + installShapeAdapters(server)（裸数组 -> {items,total} 形状适配）。
import { describe, expect, beforeEach } from "vitest";
import { server } from "../../setup.dom";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import { fnTest } from "../../fn";
import {
  resetFixtures,
  installShapeAdapters,
  seedMasterDataIntoMockDb,
} from "../../helpers/seed";
import { ReportNameList } from "@/features/inspection-capability/ReportNameList";

describe("ReportNameList 聚合列", () => {
  beforeEach(() => {
    cleanup();
    resetFixtures();
    installShapeAdapters(server);

    seedMasterDataIntoMockDb(server);
  });

  async function flush() {
    await waitFor(() => {
      expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
    });
  }

  fnTest(["M06.F07.I01"], "列表列：编码/简称/检测标准(聚合)/检测参数(聚合)/操作", async () => {
    render(<ReportNameList />);
    await flush();

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["编码", "简称", "检测标准", "检测参数", "扩展属性", "操作"]);
    // 旧列已下线
    expect(screen.queryByText("全称")).toBeNull();
    expect(screen.queryByText("模板路径")).toBeNull();
  });

  fnTest(["M06.F07.I01"], "RN-101 行聚合显示其检测标准编码与检测参数名", async () => {
    render(<ReportNameList />);
    await flush();

    // 定位 RN-101 所在行
    const codeCell = await screen.findByText("RN-101");
    const row = codeCell.closest("tr")!;
    expect(row).toBeTruthy();

    // 检测标准聚合：RN-101 关联了 GB 175-2023（可见前 5 项之一，或完整清单在 title）
    const stdCell = within(row).getByText(/GB 175-2023/);
    expect(stdCell.getAttribute("title") ?? "").toContain("GB 175-2023");

    // 检测参数聚合：RN-101 模板引用 IP-0550（凝结时间（初凝））/IP-0551（凝结时间（终凝）），
    // 完整清单仅落在 span.title（截断后仅前 5 项可见）；按 title 查询而不是 getByText。
    const paramSpan = row.querySelector('[title*="凝结时间"]');
    expect(paramSpan).not.toBeNull();
    expect(paramSpan!.getAttribute("title") ?? "").toMatch(/凝结时间/);
  });
});
