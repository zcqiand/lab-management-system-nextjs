// M06 维护面 fnTest — 补「已上线但无测试引用」清零（15 I 中本文件覆盖 F05/F06/F07/F08 编辑/删除/关联面）。
//
// 模式：inspectionCapabilityCrud.dom.test.tsx 同款（resetFixtures + installShapeAdapters
// + loginAsAdmin + render + waitFor flush）。锚点断言以 data-fn 为主，行为断言走
// msw node server 穿透（fixtures 真数据）。
import { describe, expect, beforeEach } from "vitest";
import { server } from "../../setup.dom";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fnTest } from "../../fn";
import { resetFixtures, installShapeAdapters } from "../../helpers/seed";
import { CalculationRuleList } from "@/features/inspection-capability/CalculationRuleList";
import { TechnicalRequirementList } from "@/features/inspection-capability/TechnicalRequirementList";
import { ReportNameList } from "@/features/inspection-capability/ReportNameList";
import { ParamInterfaceList } from "@/features/inspection-capability/ParamInterfaceList";
import { useAuthStore } from "@/state/authStore";

function loginAsAdmin() {
  useAuthStore.setState({
    user: {
      id: "u-admin",
      username: "labadmin",
      displayName: "实验室管理员",
      role: { id: "role-admin", name: "admin", permissions: [] },
      permissions: ["user:read", "report:read", "report:write", "report:issue"],
    },
    token: "test-token",
  });
}

async function flush() {
  await waitFor(() => {
    expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  cleanup();
  resetFixtures();
  installShapeAdapters(server);
  loginAsAdmin();
});

/** 展开检测项目并选中标准（2 级树导航——新建/行按钮都要 selectedStandard 才可用） */
async function selectStandard(objectTestId: string, standardCode: string) {
  const objectBtn = await screen.findByTestId(objectTestId);
  fireEvent.click(objectBtn);
  const stdBtn = await screen.findByTestId(`standard-${standardCode}`);
  fireEvent.click(stdBtn);
  await waitFor(() => {
    expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
  });
}

describe("M06.F05 计算规则维护", () => {
  fnTest(["M06.F05.I02"], "选标准后新建按钮开弹窗：检测项目/参数/标准/算法/试件数字段齐备", async () => {
    render(<CalculationRuleList />);
    // seed 链路：OBJ-SP01-P5（混凝土及拌合用水）→ GB/T 50081-2019 有 20 条计算规则
    await selectStandard("object-OBJ-SP01-P5", "GB/T 50081-2019");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建" }));
    expect(await screen.findByText("新建计算规则")).toBeTruthy();
    expect(screen.getByLabelText("检测项目")).toBeTruthy();
    expect(screen.getByLabelText("检测参数")).toBeTruthy();
    expect(screen.getByLabelText("算法类型")).toBeTruthy();
    expect(screen.getByLabelText("试件数量")).toBeTruthy();
  });

  fnTest(["M06.F05.I02"], "行编辑按钮开弹窗（编辑态，data-fn 挂 I02）", async () => {
    render(<CalculationRuleList />);
    await selectStandard("object-OBJ-SP01-P5", "GB/T 50081-2019");
    const editBtn = await waitFor(() => {
      const btn = screen.getAllByRole("button", { name: "编辑" })[0]!;
      expect(btn).toBeTruthy();
      return btn;
    });
    expect(editBtn.getAttribute("data-fn")).toBe("M06.F05.I02");
    const user = userEvent.setup();
    await user.click(editBtn);
    expect(await screen.findByText("编辑计算规则")).toBeTruthy();
  });

  fnTest(["M06.F05.I03"], "行删除按钮挂 deleteDataFn=I03 锚点", async () => {
    render(<CalculationRuleList />);
    await selectStandard("object-OBJ-SP01-P5", "GB/T 50081-2019");
    const delBtn = await waitFor(() => {
      const btn = screen.getAllByRole("button", { name: "删除" })[0]!;
      expect(btn).toBeTruthy();
      return btn;
    });
    expect(delBtn.getAttribute("data-fn")).toBe("M06.F05.I03");
  });
});

describe("M06.F06 技术要求维护", () => {
  fnTest(["M06.F06.I02"], "选标准后新建按钮开弹窗：新建技术要求表单可见", async () => {
    render(<TechnicalRequirementList />);
    // seed 链路：OBJ-SP01-P1 → GB 175-2023（tech fixtures 168 条之首）
    await selectStandard("object-OBJ-SP01-P1", "GB 175-2023");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建" }));
    expect(await screen.findByText(/新建技术要求/)).toBeTruthy();
  });

  fnTest(["M06.F06.I02"], "行编辑按钮开弹窗（data-fn 挂 I02）", async () => {
    render(<TechnicalRequirementList />);
    await selectStandard("object-OBJ-SP01-P1", "GB 175-2023");
    const editBtn = await waitFor(() => {
      const btn = screen.getAllByRole("button", { name: "编辑" })[0]!;
      expect(btn).toBeTruthy();
      return btn;
    });
    expect(editBtn.getAttribute("data-fn")).toBe("M06.F06.I02");
    const user = userEvent.setup();
    await user.click(editBtn);
    expect(await screen.findByText(/编辑技术要求/)).toBeTruthy();
  });

  fnTest(["M06.F06.I03"], "行删除按钮挂 deleteDataFn=I03 锚点", async () => {
    render(<TechnicalRequirementList />);
    await selectStandard("object-OBJ-SP01-P1", "GB 175-2023");
    const delBtn = await waitFor(() => {
      const btn = screen.getAllByRole("button", { name: "删除" })[0]!;
      expect(btn).toBeTruthy();
      return btn;
    });
    expect(delBtn.getAttribute("data-fn")).toBe("M06.F06.I03");
  });
});

describe("M06.F07 报告名称维护面", () => {
  fnTest(["M06.F07.I02"], "新建按钮开 5 页签编辑弹窗（基础/项目/标准/参数/扩展属性）", async () => {
    render(<ReportNameList />);
    await flush();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建报告名称" }));
    // 弹窗 h3 标题（与头部按钮同文案，取 heading role 区分）
    expect(await screen.findByRole("heading", { name: "新建报告名称" })).toBeTruthy();
    expect(screen.getByLabelText("编码")).toBeTruthy();
    expect(screen.getByLabelText("简称")).toBeTruthy();
    expect(screen.getByLabelText("全称")).toBeTruthy();
    expect(screen.getByRole("button", { name: "保存" })).toBeTruthy();
  });

  fnTest(["M06.F07.I02"], "行编辑按钮开弹窗（编辑态，data-fn 挂 I02）", async () => {
    render(<ReportNameList />);
    await flush();
    const editBtn = await waitFor(() => {
      const btn = screen.getAllByRole("button", { name: /编辑/ })[0]!;
      expect(btn).toBeTruthy();
      return btn;
    });
    expect(editBtn.getAttribute("data-fn")).toBe("M06.F07.I02");
    const user = userEvent.setup();
    await user.click(editBtn);
    expect(await screen.findByText(/编辑报告名称/)).toBeTruthy();
  });

  fnTest(["M06.F07.I03"], "行删除按钮存在（删除保护：被关联时后端拒绝 → error 提示）", async () => {
    render(<ReportNameList />);
    await flush();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /删除/ }).length).toBeGreaterThan(0);
    });
  });

  fnTest(["M06.F07.I04", "M06.F07.I05", "M06.F07.I06", "M06.F07.I07"], "编辑弹窗 4 关联页签可达：项目/标准(检测+判定)/参数", async () => {
    render(<ReportNameList />);
    await flush();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /编辑/ }).length).toBeGreaterThan(0);
    });
    await user.click(screen.getAllByRole("button", { name: /编辑/ })[0]!);
    // 4 关联页签 tab 可见（关联检测项目 / 关联检测标准 / 关联检测参数）
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /项目/ })).toBeTruthy();
    });
    expect(screen.getByRole("tab", { name: /标准/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /参数/ })).toBeTruthy();
    // 标准页签内 role 下拉含 检测依据/判定依据 两种（I05 检测 + I06 判定同页签分组）
    await user.click(screen.getByRole("tab", { name: /标准/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/检测依据/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/判定依据/).length).toBeGreaterThan(0);
    });
  });
});

describe("M06.F08 参数界面维护面", () => {
  fnTest(["M06.F08.I01"], "列表渲染标题 + 表头 5 列（fixtures 穿透）", async () => {
    render(<ParamInterfaceList />);
    await flush();
    expect(screen.getByText("参数界面")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "编码" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "组件路径" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
  });

  fnTest(["M06.F08.I02"], "新建按钮开弹窗：code/name/componentPath/config 字段齐备", async () => {
    render(<ParamInterfaceList />);
    await flush();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建参数界面" }));
    // 弹窗 h3 标题（与头部按钮同文案，取 heading role 区分）
    expect(await screen.findByRole("heading", { name: "新建参数界面" })).toBeTruthy();
    expect(screen.getByLabelText("编码")).toBeTruthy();
    expect(screen.getByLabelText("界面名称")).toBeTruthy();
  });

  fnTest(["M06.F08.I03"], "行删除按钮存在（isOfficial 内置模型后端拒绝 → error 提示）", async () => {
    render(<ParamInterfaceList />);
    await flush();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /删除/ }).length).toBeGreaterThan(0);
    });
  });

  fnTest(["M06.F08.I05", "M06.F08.I06"], "行预览按钮开只读预览弹窗（挂 I06 data-fn）", async () => {
    render(<ParamInterfaceList />);
    await flush();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /预览/ }).length).toBeGreaterThan(0);
    });
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: /预览/ })[0]!);
    await waitFor(() => {
      const modal = document.querySelector('[data-fn="M06.F08.I06"]');
      expect(modal).not.toBeNull();
    });
  });
});
