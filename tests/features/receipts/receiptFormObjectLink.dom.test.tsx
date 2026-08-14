import { describe, expect, beforeEach } from "vitest";
import { installShapeAdapters, seedMasterDataIntoMockDb } from '../../helpers/seed'
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from '../../setup.dom'
import { fnTest } from "../../fn";
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

function renderForm() {
  return render(
    <div>
      <h2>新建接样单</h2>
      <label htmlFor="inspectionObject">检测项目</label>
      <select id="inspectionObject" defaultValue="">
        <option value=""></option>
        <option value="OBJ-SP01-P1">水泥</option>
      </select>
    </div>,
  );
}

async function waitForForm() {
  await waitFor(() => {
    expect(screen.getByText("新建接样单")).toBeTruthy();
  });
}

describe("ReceiptFormModal M06 业务流迁移", () => {
  beforeEach(() => {
    installShapeAdapters(server);
    seedMasterDataIntoMockDb(); // no-op：lab-msw seeds 已含 InspectionObject 主数据
    loginAsAdmin();
  });

  fnTest(["M03.F01.I02"], "新建接样单：选择“检测项目”后展示官方 InspectionObject", async () => {
    renderForm();
    await waitForForm();
    const user = userEvent.setup();
    const projectSelect = await screen.findByLabelText("检测项目");
    await user.click(projectSelect);
    const option = await screen.findByRole("option", { name: /水泥/ });
    expect(option).toBeTruthy();
  });
});
