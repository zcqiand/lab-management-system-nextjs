import { describe, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowPanel } from "@/features/flow/FlowPanel";
import { flowReducer, initialState } from "@/state/flowReducer";
import { useFlowStore } from "@/state/flowStore";
import { fnTest } from "../fn";

beforeEach(() => {
  cleanup();
  useFlowStore.getState().reset();
});

describe("流程集成测试：FlowPanel 状态流转端到端", () => {
  fnTest(
    ["M01.F04.I02"],
    "完整正向流程：draft → submitted → testing → review → approved",
    async () => {
      const user = userEvent.setup();
      render(<FlowPanel operatorId="u-001" operatorRole="admin" />);
      // 状态标签用 exact 匹配，避免与历史记录"草稿 → 已提交"中的文本冲突
      expect(screen.getByText("草稿", { exact: true })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "提交检测" }));
      expect(screen.getByText("已提交", { exact: true })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "开始检测" }));
      expect(screen.getByText("检测中", { exact: true })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "提交复审" }));
      expect(screen.getByText("复审中", { exact: true })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "通过复审" }));
      // 终态文案在 span 中（状态标签 + 终态提示 span）
      expect(screen.getAllByText(/已通过/).length).toBeGreaterThan(0);
      // 终态无操作按钮（除重置）
      expect(
        screen.queryByRole("button", { name: "通过复审" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "拒绝" })).not.toBeInTheDocument();

      // 历史记录 4 条
      const historyItems = screen.getAllByText(/→/);
      expect(historyItems).toHaveLength(4);
    },
  );

  fnTest(["M01.F04.I02"], "拒绝流程：review → rejected", async () => {
    const user = userEvent.setup();
    render(<FlowPanel operatorId="u-001" operatorRole="admin" />);
    await user.click(screen.getByRole("button", { name: "提交检测" }));
    await user.click(screen.getByRole("button", { name: "开始检测" }));
    await user.click(screen.getByRole("button", { name: "提交复审" }));
    await user.click(screen.getByRole("button", { name: "拒绝" }));
    expect(screen.getAllByText(/已拒收/).length).toBeGreaterThan(0);
  });

  fnTest(
    ["M01.F04.I02"],
    "非法转换守卫：draft 上直接 APPROVE 应保持不变且显示错误",
    () => {
      // reducer 纯函数层
      const next = flowReducer(initialState, {
        type: "APPROVE",
        operator: "u-001",
        operatorRole: "admin",
      });
      expect(next.status).toBe("draft");
      expect(next.error).toMatch(/非法转换/);
      expect(next.history).toEqual([]);
    },
  );

  fnTest(
    ["M01.F04.I02"],
    "非法转换端到端：FlowPanel 中 draft 状态无通过按钮（UI 守卫）",
    () => {
      render(<FlowPanel operatorId="u-001" operatorRole="admin" />);
      // draft 状态下不应有通过复审按钮
      expect(
        screen.queryByRole("button", { name: "通过复审" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "拒绝" })).not.toBeInTheDocument();
    },
  );

  fnTest(
    ["M01.F04.I02"],
    "权限守卫端到端：technician 在 review 状态无通过/拒绝按钮",
    async () => {
      const user = userEvent.setup();
      render(<FlowPanel operatorId="u-002" operatorRole="technician" />);
      await user.click(screen.getByRole("button", { name: "提交检测" }));
      await user.click(screen.getByRole("button", { name: "开始检测" }));
      await user.click(screen.getByRole("button", { name: "提交复审" }));
      expect(screen.getByText("复审中", { exact: true })).toBeInTheDocument();
      // technician 无权通过/拒绝
      expect(
        screen.queryByRole("button", { name: "通过复审" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "拒绝" })).not.toBeInTheDocument();
    },
  );

  fnTest(["M01.F04.I02"], "撤回流程：submitted → draft", async () => {
    const user = userEvent.setup();
    render(<FlowPanel operatorId="u-001" operatorRole="admin" />);
    await user.click(screen.getByRole("button", { name: "提交检测" }));
    expect(screen.getByText("已提交", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "撤回" }));
    expect(screen.getByText("草稿", { exact: true })).toBeInTheDocument();
  });

  fnTest(["M01.F04.I02"], "重置：任何状态回到 draft", async () => {
    const user = userEvent.setup();
    render(<FlowPanel operatorId="u-001" operatorRole="admin" />);
    await user.click(screen.getByRole("button", { name: "提交检测" }));
    await user.click(screen.getByRole("button", { name: "开始检测" }));
    expect(screen.getByText("检测中", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重置" }));
    expect(screen.getByText("草稿", { exact: true })).toBeInTheDocument();
    // 历史清空
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  fnTest(["M01.F04.I02"], "reducer 单元测试：SUBMIT 转换正确", () => {
    const next = flowReducer(initialState, { type: "SUBMIT", operator: "u-001" });
    expect(next.status).toBe("submitted");
    expect(next.history).toHaveLength(1);
    expect(next.history[0]!.fromStatus).toBe("draft");
    expect(next.history[0]!.toStatus).toBe("submitted");
    expect(next.error).toBeNull();
  });

  fnTest(["M01.F04.I02"], "reducer 单元测试：终态 approved 不可逆", () => {
    const approved = { ...initialState, status: "approved" as const };
    const next = flowReducer(approved, { type: "SUBMIT", operator: "u-001" });
    expect(next.status).toBe("approved");
    expect(next.error).toMatch(/非法转换/);
  });
});
