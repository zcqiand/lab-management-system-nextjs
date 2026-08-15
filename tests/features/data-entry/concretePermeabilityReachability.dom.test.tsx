import { describe, expect, beforeEach } from "vitest";
import { server } from '../../setup.dom'
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { fnTest } from "../../fn";
import {installShapeAdapters, resetFixtures, seedMasterDataIntoMockDb, seedParamInterfaces, tablesOf} from '../../helpers/seed'
const { sampleTable, testRecordTable, receiptTable } = tablesOf(server)
;
import { EntryModal } from "@/features/data-entry/DataEntryPage";
import { ReceiptDetail } from "@/features/receipts/ReceiptDetail";
import type { SampleReceipt } from "@/types/api";
import { useAuthStore } from "@/state/authStore";

/**
 * REACHABILITY（REQ-2026-013 AC-3 + 用户反馈 RC-2024-0712-02）：
 * 打开任一含 IP-0190 的接样单（含用户真实创建的 RC-2024-0712-02），
 * 数据录入 EntryModal + 详情信息 ReceiptDetail 都应渲染 concrete-permeability 卡（抗渗等级）。
 * 这要求 IP-0190 在 inspection-parameter-param-interface.json 关联 concrete-permeability。
 */

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

/** 模拟用户 RC-2024-0712-02（接样单） + 一个含 IP-0190 的样品 */
function buildRc2024071202(): SampleReceipt {
  return {
    id: "rc-2024-0712-02",
    contractId: "c-2024-0712",
    commissionCode: "RC-2024-0712-02",
    commissionDate: "2024-07-12",
    categoryCode: "RN-105-1",
    receivedBy: "实验员",
    sampleSource: "施工送检",
    testCategory: "委托检验",
    flowStatus: "data_entry",
    flowHistory: [],
    lastSubmittedBy: null,
    testParameters: ["IP-0190"],
    createdAt: "2024-07-12T00:00:00Z",
    updatedAt: "2024-07-12T00:00:00Z",
  };
}

function ensureRcSample(): void {
  // 接样单：MSW handler GET /receipts/{id} 必须找得到
  if (!receiptTable.findById("rc-2024-0712-02")) {
    receiptTable.insert({
      id: "rc-2024-0712-02",
      tenantId: "TENANT-001",
      contractId: "c-2024-0712",
      commissionCode: "RC-2024-0712-02",
      commissionDate: "2024-07-12",
      categoryCode: "RN-105-1",
      receivedBy: "实验员",
      sampleSource: "施工送检",
      testCategory: "委托检验",
      flowStatus: "data_entry",
      flowHistory: [],
      lastSubmittedBy: null,
      testParameters: ["IP-0190"],
      createdAt: "2024-07-12T00:00:00Z",
      updatedAt: "2024-07-12T00:00:00Z",
    } as never);
  }
  const has = sampleTable.all().find((s) => s.receiptId === "rc-2024-0712-02");
  if (!has) {
    sampleTable.insert({
      id: "s-2024-0712-02-1",
      tenantId: "TENANT-001",
      receiptId: "rc-2024-0712-02",
      sampleCode: "RC-2024-0712-02-S1",
      sampleName: "混凝土抗渗试件",
      ext: {},
    } as never);
    // 给样品加 IP-0190 testRecord，ReceiptDetail 才能渲染出新卡片
    testRecordTable.insert({
      id: "ti-2024-0712-02-1-IP0190",
      tenantId: "TENANT-001",
      sampleId: "s-2024-0712-02-1",
      parameterCode: "IP-0190",
      requirement: "",
      result: "",
      verdict: "",
    } as never);
  }
}

describe("concrete-permeability reachability RC-2024-0712-02（数据录入 + 详情信息）", () => {
  beforeEach(() => {
    cleanup();
    // REF setup.ts afterEach resetDb() 的本仓等价物：恢复 fixtures 快照（清掉上个测试的 insert）
    resetFixtures();
    // msw dictCrud/链接 GET 返回裸数组 → REF 组件期望 {items}；beforeEach 重装（afterEach resetHandlers 会清）
    installShapeAdapters(server);

    seedMasterDataIntoMockDb(server);
    seedParamInterfaces(server); // 灌入 default / concrete-compress / concrete-permeability + IP-0055/IP-0190 ↔ interface 关联
    loginAsAdmin();
    ensureRcSample();
  });

  fnTest(
    ["M03.F03.I03", "M06.F08.I04"],
    "EntryModal 打开 RC-2024-0712-02 渲染 concrete-permeability 卡（含「抗渗等级」label）",
    async () => {
      render(
          <EntryModal receipt={buildRc2024071202()} onClose={() => {}} />
      );
      // 等接口派发完成 + 卡片渲染
      await waitFor(
        () => {
          // 「抗渗等级」是 concrete-permeability 卡独占的 label（默认四格卡没有）
          expect(screen.queryByText(/抗渗等级/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      // 6 个试件行（aria-label="试件 N 渗水压力"）
      expect(screen.getAllByLabelText(/试件 \d+ 渗水压力/)).toHaveLength(6);
      expect(screen.getAllByLabelText(/试件 \d+ 渗水情况/)).toHaveLength(6);
    },
  );

  fnTest(
    ["M03.F09.I02", "M06.F08.I04"],
    "ReceiptDetail 打开 RC-2024-0712-02 渲染 concrete-permeability 卡（含「抗渗等级」label）",
    async () => {
      // ReceiptDetail 是纯组件，receiptId + categoryCode 由 props 传入（路由层 ReceiptDetailPage 才用 useParams）
      render(
          <ReceiptDetail receiptId="rc-2024-0712-02" categoryCode="RN-105-1" />
      );
      // 等详情页加载（从 MSW 拉接样单 + 样品 + testRecords + 接口派发）
      await waitFor(
        () => {
          expect(screen.queryByText(/抗渗等级/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      // 6 个试件行（详情页也是只读模式）
      expect(screen.getAllByLabelText(/试件 \d+ 渗水压力/)).toHaveLength(6);
      // 详情页不应出现「无可录入的检测参数」空态
      expect(
        screen.queryByText("无可录入的检测参数（接样单未关联参数）"),
      ).not.toBeInTheDocument();
    },
  );
});