// REF tests/features/inspection-capability/reportNameExtFieldsEditor.test.tsx 移植。
// 差异：
// - MemoryRouter 去除（组件不走路由，直接 render）；
// - server/setup 引用改本仓路径（../../setup.dom）；
// - REF 的 seedMasterDataIntoMockDb + seedReportNames 替换为本仓范本模式：
//   resetFixtures()（msw seeds 即同一份 generated 报告名称/关联数据，快照恢复）
//   + installShapeAdapters(server)（裸数组 -> {items,total} 形状适配）。
import { describe, expect, beforeEach } from "vitest";
import { server } from "../../setup.dom";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { fnTest } from "../../fn";
import {
  resetFixtures,
  installShapeAdapters,
  seedMasterDataIntoMockDb,
} from "../../helpers/seed";
import { ReportNameList } from "@/features/inspection-capability/ReportNameList";

/** 用 aria-label 选输入控件（getByLabelText 对 aria-label 支持不稳）。 */
function qa<T extends HTMLElement>(label: string): T {
  const el = document.querySelector(`[aria-label="${label}"]`);
  if (!el) throw new Error(`未找到 aria-label=${label} 的元素`);
  return el as T;
}

describe("ReportNameList 扩展属性维护（M06.F07.I08）", () => {
  beforeEach(() => {
    cleanup();
    resetFixtures();
    installShapeAdapters(server);

    seedMasterDataIntoMockDb(server);
  });

  async function openEditRn101() {
    render(<ReportNameList />);
    await screen.findByText("RN-101");
    const rn101Row = screen.getByText("RN-101").closest("tr");
    if (!rn101Row) throw new Error("RN-101 行未渲染");
    const editBtn = rn101Row.querySelector(
      'button[aria-label^="编辑"]',
    ) as HTMLButtonElement;
    fireEvent.click(editBtn);
    await screen.findByText(/编辑报告名称\s*[—-]\s*RN-101/);
  }

  fnTest(["M06.F07.I08"], "页签新增「扩展属性」，data-fn=M06.F07.I08", async () => {
    await openEditRn101();
    const tab = screen.getByRole("tab", { name: "扩展属性" });
    expect(tab.getAttribute("data-fn")).toBe("M06.F07.I08");
  });

  fnTest(["M06.F07.I08"], "列表新增「扩展属性」列展示已有 extFields", async () => {
    render(<ReportNameList />);
    await screen.findByText("RN-101");
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toContain("扩展属性");
  });

  fnTest(["M06.F07.I08"], "扩展属性列存在，编辑弹窗含「扩展属性」页签", async () => {
    // 列头存在
    render(<ReportNameList />);
    await screen.findByText("RN-101");
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toContain("扩展属性");
    // 编辑弹窗含「扩展属性」页签，data-fn=M06.F07.I08
    const rn101Row = screen.getByText("RN-101").closest("tr")!;
    fireEvent.click(rn101Row.querySelector('button[aria-label^="编辑"]')!);
    await screen.findByText(/编辑报告名称\s*[—-]\s*RN-101/);
    const tab = screen.getByRole("tab", { name: "扩展属性" });
    expect(tab).toBeInTheDocument();
    expect(tab.getAttribute("data-fn")).toBe("M06.F07.I08");
  });

  fnTest(
    ["M06.F07.I08"],
    "扩展属性页签：空表 + + 新增 按钮 / 删除按钮 可见；type=select 时 options 输入可写",
    async () => {
      await openEditRn101();
      // 保存后才能切到「扩展属性」页签
      fireEvent.click(screen.getByText("保存"));
      await waitFor(() => {
        const tab = screen.getByRole("tab", { name: "扩展属性" });
        expect(tab.hasAttribute("disabled")).toBe(false);
      });
      fireEvent.click(screen.getByRole("tab", { name: "扩展属性" }));
      // 初始为空，显示提示
      expect(screen.getByText(/暂无扩展属性/)).toBeInTheDocument();
      expect(screen.getByText("+ 新增")).toBeInTheDocument();
      // + 新增 一行后渲染 8 列（含 aria-label 的输入控件）
      fireEvent.click(screen.getByText("+ 新增"));
      await waitFor(() => {
        expect(qa<HTMLInputElement>("extFields[0].key")).toBeTruthy();
      });
      // 验证：8 列控件都在（key / label / type / tag / required / source / options / 删除）
      expect(qa<HTMLInputElement>("extFields[0].key")).toBeTruthy();
      expect(qa<HTMLInputElement>("extFields[0].label")).toBeTruthy();
      expect(qa<HTMLSelectElement>("extFields[0].type")).toBeTruthy();
      expect(qa<HTMLInputElement>("extFields[0].tag")).toBeTruthy();
      expect(qa<HTMLInputElement>("extFields[0].required")).toBeTruthy();
      expect(qa<HTMLSelectElement>("extFields[0].source")).toBeTruthy();
      // 初始 type='text' -> options 输入禁用
      expect(qa<HTMLInputElement>("extFields[0].options").disabled).toBe(true);
      // 切 type=select -> options 启用
      fireEvent.change(qa<HTMLSelectElement>("extFields[0].type"), {
        target: { value: "select" },
      });
      await waitFor(() => {
        expect(qa<HTMLInputElement>("extFields[0].options").disabled).toBe(false);
      });
      // 再 + 1 -> 共 2 行
      fireEvent.click(screen.getByText("+ 新增"));
      await waitFor(() => {
        expect(qa<HTMLInputElement>("extFields[1].key")).toBeTruthy();
      });
      // 验证 2 行各有一个「删除」按钮（aria-label "删除 0" / "删除 1"）
      expect(screen.getByLabelText("删除 0")).toBeInTheDocument();
      expect(screen.getByLabelText("删除 1")).toBeInTheDocument();
    },
  );
});
