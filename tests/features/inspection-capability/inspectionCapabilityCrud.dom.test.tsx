// REF tests/features/inspection-capability/inspectionCapabilityCrud.test.tsx 移植。
// 差异：MemoryRouter 去除（组件 resource 用 props）；seed/setup 引用改本仓路径；
// REF 直连 fetch("http://localhost/api/...") 改 apiClient（同 msw node server）；
// apiClient.get spy 断言按 API_ROUTES 映射后的 lab-msw 路由断言。
import { describe, expect, beforeEach, vi, afterEach, it } from "vitest";
import { server } from "../../setup.dom";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fnTest } from "../../fn";
import {
  resetFixtures,
  installShapeAdapters,
  seedMasterDataIntoMockDb,
} from "../../helpers/seed";
import { InspectionCapabilityPage } from "@/features/inspection-capability/InspectionCapabilityPage";
import { AssociationManager } from "@/features/inspection-capability/AssociationManager";
import { apiClient, API_ROUTES } from "@/api/legacy-client";
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

function renderPage(
  resource: "specialties" | "objects" | "parameters" | "standards",
) {
  return render(<InspectionCapabilityPage resource={resource} />);
}

async function flush() {
  await waitFor(() => {
    expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
  });
}

describe("InspectionCapabilityPage M06 CRUD 入口", () => {
  beforeEach(() => {
    cleanup();
    resetFixtures();
    installShapeAdapters(server);

    seedMasterDataIntoMockDb(server);
    loginAsAdmin();
  });

  fnTest(["M06.F01.I02"], "检测专项页打开“新建专项”弹窗", async () => {
    renderPage("specialties");
    await flush();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建专项" }));
    const dialog = await screen.findByRole("heading", { name: "新建检测专项", level: 3 });
    expect(dialog).toBeTruthy();
  });

  fnTest(["M06.F01.I02"], "新建检测专项 启用 复选框默认勾选", async () => {
    renderPage("specialties");
    await flush();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建专项" }));
    const enabled = (await screen.findByLabelText("启用")) as HTMLInputElement;
    // 新建态默认启用（回归 payload.enabled ?? true 因 checkbox 恒为布尔而失效的缺陷）
    expect(enabled.checked).toBe(true);
  });

  fnTest(["M06.F02.I01"], "检测项目页按检测专项过滤", async () => {
    const getSpy = vi.spyOn(apiClient, "get");
    renderPage("objects");
    await flush();
    const select = screen.getByLabelText("检测专项筛选") as HTMLSelectElement;
    expect(select).toBeTruthy();
    const user = userEvent.setup();
    await user.selectOptions(select, "SP01");
    await flush();
    const filteredCall = getSpy.mock.calls.find(
      ([path, cfg]) =>
        path === API_ROUTES["/inspection-objects"] &&
        (cfg as unknown as { params?: { inspectionSpecialtyCode?: string } })?.params
          ?.inspectionSpecialtyCode === "SP01",
    );
    expect(filteredCall).toBeTruthy();
  });

  fnTest(["M06.F02.I02"], "检测项目页打开“新建项目”弹窗", async () => {
    renderPage("objects");
    await flush();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "新建项目" });
    await user.click(button);
    const dialog = await screen.findByRole("heading", { name: "新建检测项目", level: 3 });
    expect(dialog).toBeTruthy();
  });

  fnTest(["M06.F03.I02"], "检测参数页打开“新建参数”弹窗", async () => {
    renderPage("parameters");
    await flush();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "新建参数" });
    await user.click(button);
    const dialog = await screen.findByRole("heading", { name: "新建检测参数", level: 3 });
    expect(dialog).toBeTruthy();
  });

  fnTest(["M06.F04.I02"], "检测标准页打开“新建标准”弹窗", async () => {
    renderPage("standards");
    await flush();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "新建标准" });
    await user.click(button);
    const dialog = await screen.findByRole("heading", { name: "新建检测标准", level: 3 });
    expect(dialog).toBeTruthy();
  });

  fnTest(["M06.F01.I02"], "检测专项编辑弹窗预填并提交 PUT", async () => {
    // 先建一个自定义专项供编辑
    await apiClient.post(API_ROUTES["/inspection-specialties"], {
      code: "SP90",
      name: "待编辑专项",
      isOfficial: false,
      enabled: true,
    });
    renderPage("specialties");
    await flush();
    const user = userEvent.setup();
    // SP90 行的编辑按钮
    const editBtn = await screen.findByRole("button", { name: `编辑 SP90` });
    await user.click(editBtn);
    const heading = await screen.findByRole("heading", {
      name: "编辑检测专项",
      level: 3,
    });
    expect(heading).toBeTruthy();
    // 名称字段已预填
    const nameInput = screen.getByLabelText("名称") as HTMLInputElement;
    expect(nameInput.value).toBe("待编辑专项");
    await user.clear(nameInput);
    await user.type(nameInput, "已编辑专项");
    await user.click(screen.getByRole("button", { name: "保存" }));
    // 保存后弹窗关闭
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "编辑检测专项", level: 3 }),
      ).toBeNull();
    });
  });

  fnTest(
    ["M06.F03.I02"],
    "检测参数编辑弹窗渲染补足字段（sourceType/aliases）",
    async () => {
      await apiClient.post(API_ROUTES["/inspection-parameters"], {
        code: "IP-FORM-1",
        name: "表单参数",
        sourceType: "custom",
      });
      renderPage("parameters");
      await flush();
      const user = userEvent.setup();
      // 参数主表已回填数百条，分页后目标不在首页——用搜索框过滤到它
      await user.type(screen.getByLabelText("搜索"), "IP-FORM-1");
      await user.click(await screen.findByRole("button", { name: "编辑 IP-FORM-1" }));
      expect(await screen.findByLabelText("来源类型")).toBeTruthy();
      expect(screen.getByLabelText("别名（逗号分隔）")).toBeTruthy();
    },
  );

  fnTest(["M06.F03.I03"], "检测参数删除被引用时展示错误", async () => {
    renderPage("parameters");
    await flush();
    const user = userEvent.setup();
    // 参数主表已回填数百条，分页后目标不在首页——用搜索框过滤到它
    await user.type(screen.getByLabelText("搜索"), "IP-0001");
    // IP-0001（凝结时间）是官方参数，删除按钮 disabled，不会触发请求；验证其删除按钮被禁用
    const delBtn = await screen.findByRole("button", { name: `删除 IP-0001` });
    expect((delBtn as HTMLButtonElement).disabled).toBe(true);
  });

  fnTest(["M06.F01.I03"], "检测专项删除自定义未引用专项成功", async () => {
    await apiClient.post(API_ROUTES["/inspection-specialties"], {
      code: "SP91",
      name: "可删专项",
      isOfficial: false,
      enabled: true,
    });
    renderPage("specialties");
    await flush();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `删除 SP91` }));
    // 确认弹窗
    await user.click(await screen.findByRole("button", { name: "确认" }));
    // 列表刷新后 SP91 消失，且列表确实完成了重新加载（稳定的官方专项 SP01 仍在，
    // 而非停留在“空 + 加载中”态——回归 load() 误触发 abort 导致刷新被中断的 bug）
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: `删除 SP91` })).toBeNull();
      expect(screen.getByRole("button", { name: `删除 SP01` })).toBeTruthy();
    });
  });

  fnTest(
    ["M06.F04.I01"],
    "检测标准页级联下拉：选专项后请求带 inspectionSpecialtyCode",
    async () => {
      // standards 主表行没有 inspectionSpecialtyCode 列——REF 语义经 junction 过滤。
      // 本仓 msw seeds 的 standards 无该列，这里断言请求参数发出（getSpy）即可。
      const getSpy = vi.spyOn(apiClient, "get");
      renderPage("standards");
      await flush();
      const user = userEvent.setup();
      const spSelect = screen.getByLabelText("检测专项筛选");
      await user.selectOptions(spSelect, "SP01");
      await flush();
      const hit = getSpy.mock.calls.find(
        ([path, cfg]) =>
          path === API_ROUTES["/inspection-standards"] &&
          (cfg as unknown as { params?: { inspectionSpecialtyCode?: string } })?.params
            ?.inspectionSpecialtyCode === "SP01",
      );
      expect(hit).toBeTruthy();
    },
  );

  fnTest(
    ["M06.F03.I01"],
    "检测参数页三级级联：选专项→项目→标准后请求带全部参数",
    async () => {
      const getSpy = vi.spyOn(apiClient, "get");
      renderPage("parameters");
      await flush();
      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText("检测专项筛选"), "SP01");
      await flush();
      await user.selectOptions(
        await screen.findByLabelText("检测项目筛选"),
        "OBJ-SP01-P1",
      );
      await flush();
      await user.selectOptions(
        await screen.findByLabelText("检测标准筛选"),
        "GB 175-2023",
      );
      await flush();
      const hit = getSpy.mock.calls.find(
        ([path, cfg]) =>
          path === API_ROUTES["/inspection-parameters"] &&
          (cfg as unknown as { params?: Record<string, string> })?.params
            ?.inspectionSpecialtyCode === "SP01" &&
          (cfg as unknown as { params?: Record<string, string> })?.params
            ?.inspectionObjectCode === "OBJ-SP01-P1" &&
          (cfg as unknown as { params?: Record<string, string> })?.params
            ?.inspectionStandardCode === "GB 175-2023",
      );
      expect(hit).toBeTruthy();
    },
  );

  fnTest(["M06.F02.I06"], "AssociationManager 列出/添加/移除关联", async () => {
    // 给 OBJ-SP01-P1 建一条自定义参数关联用于移除
    await apiClient.post(API_ROUTES["/inspection-parameters"], {
      code: "IP-AM-1",
      name: "AM 参数",
      sourceType: "custom",
    });
    await apiClient.post(API_ROUTES["/inspection-object-parameters"], {
      inspectionObjectCode: "OBJ-SP01-P1",
      inspectionParameterCode: "IP-AM-1",
    });
    render(
      <AssociationManager
        ariaLabel="OBJ-SP01-P1 关联检测参数"
        endpoint="/inspection-object-parameters"
        parentParam="inspectionObjectCode"
        parentCode="OBJ-SP01-P1"
        targetLabel="检测参数"
        targetEndpoint="/inspection-parameters"
        targetParam="inspectionParameterCode"
        targetValueKey="code"
        targetTextKey="name"
      />,
    );
    const user = userEvent.setup();
    // 关联行以“移除”按钮唯一标识（下拉选项也含目标名称，故不能用 findByText 断言）
    expect(await screen.findByRole("button", { name: "移除 IP-AM-1" })).toBeTruthy();
    // 行内显示目标可读名称（限定在列表区域内，避开下拉选项同名文本）
    expect(within(screen.getByRole("list")).getByText("AM 参数")).toBeTruthy();
    // 移除
    await user.click(screen.getByRole("button", { name: "移除 IP-AM-1" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "移除 IP-AM-1" })).toBeNull(),
    );
  });

  fnTest(["M06.F02.I06"], "AssociationManager 行内前缀：必备参数以 * 呈现", async () => {
    render(
      <AssociationManager
        ariaLabel="OBJ-SP01-P1 关联检测参数"
        endpoint="/inspection-object-parameters"
        parentParam="inspectionObjectCode"
        parentCode="OBJ-SP01-P1"
        targetLabel="检测参数"
        targetEndpoint="/inspection-parameters"
        targetParam="inspectionParameterCode"
        targetValueKey="code"
        targetTextKey="name"
        extraFields={[
          {
            name: "qualificationLevel",
            label: "资质级别",
            type: "select",
            options: ["QUALIFIED", "RESTRICTED"],
            valueLabels: { QUALIFIED: "必备", RESTRICTED: "可选" },
            rowPrefix: { QUALIFIED: "*", RESTRICTED: "" },
          },
        ]}
      />,
    );
    // 种子 OBJ-SP01-P1 含 IP-0001(凝结时间, QUALIFIED) → 行内呈现 *凝结时间（无「· 资质级别: 必备」后缀）
    const list = await screen.findByRole("list");
    expect(await within(list).findByText("*凝结时间")).toBeTruthy();
  });

  fnTest(["M06.F02.I04"], "AssociationManager 行内前缀：检测标准性质以【】呈现", async () => {
    render(
      <AssociationManager
        ariaLabel="OBJ-SP01-P1 关联检测标准"
        endpoint="/inspection-object-standards"
        parentParam="inspectionObjectCode"
        parentCode="OBJ-SP01-P1"
        targetLabel="检测标准"
        targetEndpoint="/inspection-standards"
        targetParam="inspectionStandardCode"
        targetValueKey="code"
        targetTextKey="name"
        extraFields={[
          {
            name: "role",
            label: "标准性质",
            type: "select",
            options: ["TESTING", "JUDGMENT"],
            valueLabels: { TESTING: "检测依据", JUDGMENT: "判定依据" },
            rowPrefix: { TESTING: "【检测依据】", JUDGMENT: "【判定依据】" },
          },
        ]}
      />,
    );
    // 种子 OBJ-SP01-P1 关联 GB 175-2023(TESTING) → 行内以【检测依据】为前缀
    const list = await screen.findByRole("list");
    const rows = await within(list).findAllByText((t) => t.startsWith("【检测依据】"));
    expect(rows.length).toBeGreaterThan(0);
  });

  fnTest(["M06.F02.I06"], "检测项目编辑弹窗出现 关联检测参数 页签", async () => {
    renderPage("objects");
    await flush();
    const user = userEvent.setup();
    const editBtns = await screen.findAllByRole("button", { name: /^编辑 / });
    await user.click(editBtns[0]!);
    expect(await screen.findByRole("button", { name: "关联检测参数" })).toBeTruthy();
  });

  fnTest(["M06.F04.I04"], "检测标准编辑弹窗出现 关联检测参数 页签", async () => {
    renderPage("standards");
    await flush();
    const user = userEvent.setup();
    const editBtns = await screen.findAllByRole("button", { name: /^编辑 / });
    await user.click(editBtns[0]!);
    expect(await screen.findByRole("button", { name: "关联检测参数" })).toBeTruthy();
  });

  fnTest(["M06.F02.I04", "M06.F02.I05"], "检测标准关联 标准性质 下拉以中文呈现", async () => {
    renderPage("objects");
    await flush();
    const user = userEvent.setup();
    const editBtns = await screen.findAllByRole("button", { name: /^编辑 / });
    await user.click(editBtns[0]!);
    await user.click(await screen.findByRole("button", { name: "关联检测标准" }));
    const select = await screen.findByLabelText("标准性质");
    expect(within(select).getByRole("option", { name: "检测依据" })).toBeTruthy();
    expect(within(select).getByRole("option", { name: "判定依据" })).toBeTruthy();
  });

  fnTest(["M06.F02.I06"], "检测参数关联 资质级别 下拉以中文呈现", async () => {
    renderPage("objects");
    await flush();
    const user = userEvent.setup();
    const editBtns = await screen.findAllByRole("button", { name: /^编辑 / });
    await user.click(editBtns[0]!);
    await user.click(await screen.findByRole("button", { name: "关联检测参数" }));
    const select = await screen.findByLabelText("资质级别");
    expect(within(select).getByRole("option", { name: "必备" })).toBeTruthy();
    expect(within(select).getByRole("option", { name: "可选" })).toBeTruthy();
  });

  fnTest(["M06.F04.I01"], "检测标准清单状态以中文显示（现行）", async () => {
    renderPage("standards");
    await flush();
    expect((await screen.findAllByText("现行")).length).toBeGreaterThan(0);
  });

  fnTest(["M06.F02.I01"], "检测项目清单聚合显示检测参数名", async () => {
    renderPage("objects");
    await flush();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("搜索"), "OBJ-SP01-P1");
    await flush();
    // 水泥(OBJ-SP01-P1) 聚合列含 凝结时间
    expect((await screen.findAllByText((t) => t.includes("凝结时间"))).length).toBeGreaterThan(0);
  });

  fnTest(["M06.F03.I01"], "检测参数清单分页：可翻到下一页", async () => {
    renderPage("parameters");
    await flush();
    const next = await screen.findByRole("button", { name: "下一页" });
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  // 防御性用例：当 apiClient.get 返回畸形响应（无 items 字段，例如 MSW 未启动时
  // /api/* 被 bypass 返回 index.html）时，页面不得抛错，
  // 而是落入 error/empty 分支。回归浏览器 MSW 起不来导致的运行时崩溃。
  describe("畸形响应防御", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("apiClient.get 返回空对象时不抛错，落入 error/empty 分支", async () => {
      const malformed = { data: {} } as unknown as {
        data: { items: never[]; total: number };
      };
      vi.spyOn(apiClient, "get").mockResolvedValue(malformed);

      // 渲染本身不得抛错
      expect(() => render(<InspectionCapabilityPage resource="specialties" />)).not.toThrow();

      // 等待 loading 结束后，应出现 error 提示或"暂无数据"，二者满足其一即可
      await waitFor(() => {
        const alert = screen.queryByRole("alert");
        const empty = screen.queryByText("暂无数据");
        expect(alert !== null || empty !== null).toBe(true);
      });
    });
  });
});
