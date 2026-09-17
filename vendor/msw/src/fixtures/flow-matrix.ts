// M03 流程全矩阵 mock 生成器（加载期确定性派生，不落静态 JSON）。
//
// 背景：M03 种子设计为「每个报告名称 × 每个流程阶段 × 1 条」轻量骨架（30 报告
// × 7 阶段 = 210 条）。其中前 2 阶段（receiving/task_assignment）只填委托书级字段
// （judgmentBasis/testingBasis/testParameters），不含样品；data_entry 起每条
// 派 1 条 sample + 1 条 testRecord（30 × 5 = 150 each）。
// 注：上一版本 k=4 (900 条) 因体量过大被回退至此版本。
//
// 语义对齐 FlowStagePage 三态过滤（lab-msw handler / lab-nextjs /api/receipts）：
//   - 停在环节 S 的 1 条 = S 页「未提交」1 条；
//   - 同一份单据在不同 S 上各占一格 = S-1 页「已提交」通过 history 体现；
//   - 210 条覆盖 30 报告 × 7 阶段（reporing → archived），不含 completed 终态。
//
// 确定性：无 Date.now/random，全部编号/日期由序号派生，跨进程稳定（测试可复现）。

import type {
  Contract,
  InspectionParameter,
  InspectionReportName,
  ReportNameParameterLink,
  ReportNameStandardLink,
  Sample,
  SampleReceipt,
  TestRecord,
  FlowHistoryEntry,
  FlowStatus,
} from "../generated_ts_shim";

/** 7 个流程环节页（receiving -> archived）；completed 是终态不设页面 */
const STAGES: FlowStatus[] = [
  "receiving",
  "task_assignment",
  "data_entry",
  "review",
  "approval",
  "issuance",
  "archived",
];

/** 完整流转路径（含终态 completed）：PATH[t] -> PATH[t+1] 由 TRANSITION_OPERATOR[t] 提交 */
const PATH: FlowStatus[] = [...STAGES, "completed"];

/** 各环节停留单据的 remark（与手写故事种子同款文案） */
const STAGE_REMARK: Record<FlowStatus, string> = {
  receiving: "刚接样,未提交",
  task_assignment: "待分配检测人员",
  data_entry: "数据录入中",
  review: "待审核",
  approval: "待批准",
  issuance: "已批准,待发放",
  archived: "已发放,待归档",
  completed: "已完成归档",
};

/** 离开环节 -> 操作人（transition i: STAGES[i] -> STAGES[i+1]，最后一条是 archived->completed） */
const TRANSITION_OPERATOR = [
  "收样员甲", // receiving -> task_assignment
  "检测员A", // task_assignment -> data_entry
  "检测员A", // data_entry -> review
  "审核员B", // review -> approval
  "批准人C", // approval -> issuance
  "发放员D", // issuance -> archived
  "归档员E", // archived -> completed
];

const TRANSITION_HOUR = ["10", "09", "16", "10", "15", "15", "16"];

const TENANT = "TENANT-001";
const DATA_ENTRY_IDX = STAGES.indexOf("data_entry");
const ISSUANCE_IDX = STAGES.indexOf("issuance");

export interface FlowMatrixDeps {
  contracts: Contract[];
  reportNames: InspectionReportName[];
  reportNameStandards: ReportNameStandardLink[];
  reportNameParameters: ReportNameParameterLink[];
  parameters: InspectionParameter[];
}

/** 主入口：生成 { receipts, samples, testRecords }，由 fixtures/seed.ts 并入导出数组 */
export function buildFlowMatrix(deps: FlowMatrixDeps): {
  receipts: SampleReceipt[];
  samples: Sample[];
  testRecords: TestRecord[];
} {
  const receipts: SampleReceipt[] = [];
  const samples: Sample[] = [];
  const testRecords: TestRecord[] = [];
  let n = 0; // 全局序号（决定 id/委托书编号/日期，保持稳定）

  const paramName = (code: string) =>
    deps.parameters.find((p) => p.code === code)?.name ?? code;

  for (const [rIdx, rn] of deps.reportNames.entries()) {
    const contract = deps.contracts[rIdx % Math.max(1, deps.contracts.length)] ?? deps.contracts[0];
    if (!contract || !rn?.code) continue;

    const paramCodes = deps.reportNameParameters
      .filter((l) => l.reportNameCode === rn.code)
      .map((l) => l.inspectionParameterCode);
    const judgmentBasis = deps.reportNameStandards
      .filter((l) => l.reportNameCode === rn.code && l.role === "JUDGMENT")
      .map((l) => l.inspectionStandardCode);
    const testingBasis = deps.reportNameStandards
      .filter((l) => l.reportNameCode === rn.code && l.role === "TESTING")
      .map((l) => l.inspectionStandardCode);

    /** 每报告的生成计划：7 阶段各 1 条（共 30 × 7 = 210 条；completed 为终态不入表） */
    const plan: { stage: FlowStatus; k: number }[] = STAGES.map((stage) => ({
      stage,
      k: 1,
    }));

    for (const { stage, k } of plan) {
      const stageIdx = PATH.indexOf(stage);
      for (let i = 1; i <= k; i++) {
        n += 1;
        const pad = String(n).padStart(4, "0");
        const day = String((n % 26) + 1).padStart(2, "0");
        const commissionDate = `2026-07-${day}`;
        const receivedBy = rIdx % 2 === 0 ? "收样员甲" : "收样员乙";
        const testOperator = rIdx % 2 === 0 ? "检测员A" : "检测员B";

        // 流转历史：PATH[0] -> ... -> stage（每步 submit，操作人/时间由转移序号派生）
        const flowHistory: FlowHistoryEntry[] = [];
        for (let t = 0; t < stageIdx; t++) {
          const hh = TRANSITION_HOUR[t] ?? "10";
          const tDay = String(((n + t) % 26) + 1).padStart(2, "0");
          const from = PATH[t];
          const to = PATH[t + 1];
          if (!from || !to) continue; // noUncheckedIndexedAccess 收窄（循环上界保证不触发）
          flowHistory.push({
            action: "submit",
            from,
            to,
            operator: TRANSITION_OPERATOR[t] ?? "系统",
            at: `2026-07-${tDay}T${hh}:00:00Z`,
          });
        }
        const lastSubmittedBy = flowHistory.at(-1)?.operator ?? "";

        const doTest = stageIdx >= DATA_ENTRY_IDX; // data_entry 起有检测实施字段
        const doReport = stageIdx >= ISSUANCE_IDX; // issuance 起有报告编号/结论

        receipts.push({
          id: `RECEIPT-FM-${pad}`,
          tenantId: TENANT,
          contractId: contract.id,
          commissionCode: `WS-2026-F${pad}`,
          commissionDate,
          commissionRegisterCode: `DJ-2026-F${pad}`,
          commissionRegisterDate: commissionDate,
          categoryCode: rn.code,
          projectName: contract.projectName,
          clientUnit: contract.clientUnit,
          buildingUnit: contract.buildingUnit,
          constructionUnit: contract.constructionUnit,
          witnessUnit: contract.witnessUnit,
          samplingLocation: `${rn.name}检测部位-${i}`,
          witness: contract.witness,
          witnessPhone: contract.witnessPhone,
          inspector: rIdx % 2 === 0 ? "李工" : "刘工",
          inspectorPhone: rIdx % 2 === 0 ? "13800000001" : "13900000001",
          receivedBy,
          sampleSource: "现场",
          testCategory: "见证取样",
          testEnvironment: "常温",
          mainEquipment: doTest ? "万能试验机 WAW-1000" : "",
          testOperator: doTest ? testOperator : "",
          testStartDate: doTest ? commissionDate : "",
          testEndDate: doTest ? `2026-07-${String(((n + 2) % 26) + 1).padStart(2, "0")}` : "",
          originalRecordNo: doTest ? `JL-2026-F${pad}` : "",
          remark: STAGE_REMARK[stage],
          judgmentBasis: [...judgmentBasis], // 委托书级字段：状态无关，receiving/task_assignment 也填
          testingBasis: [...testingBasis],
          testParameters: paramCodes,
          flowStatus: stage,
          flowHistory,
          lastSubmittedBy,
          assigneeId: stageIdx >= 1 ? (rIdx % 2 === 0 ? "USER-A" : "USER-B") : "",
          assigneeName: stageIdx >= 1 ? testOperator : "",
          plannedTestDate: stageIdx >= 1 ? commissionDate : "",
          reportCode: doReport ? `BG-2026-F${pad}` : "",
          reportDate: doReport ? commissionDate : "",
          conclusion: doReport ? "所检项目符合标准要求" : "",
          result: doReport ? "pass" : "",
          issuedAt: doReport ? `2026-07-${day}T09:00:00Z` : null,
          createdAt: "",
          updatedAt: "",
        } as unknown as SampleReceipt);

        // 样品 = 委托书级物理记录：每个 receipt 都挂 1 条（receiving 阶段已在现场接样）；
        // testRecord 仍要 doTest 门控（无检测结果时 record 不应有结论）—— 拆 2 段 if。
        const firstParam = paramCodes[0];
        let sampleId = "";
        if (firstParam) {
          sampleId = `SAMPLE-FM-${pad}`;
          samples.push({
            id: sampleId,
            tenantId: TENANT,
            receiptId: `RECEIPT-FM-${pad}`,
            sampleCode: `YP-2026-F${pad}-01`,
            sampleName: `${rn.name}试样`,
            model: "",
            specification: "标准试样",
            grade: "",
            brand: "",
            manufacturer: "某厂",
            structuralPart: `${rn.name}检测部位-${i}`,
            representQuantity: "1 组",
            sampleQuantity: "1 组",
            batchNumber: `PC-F${pad}`,
            supplyUnit: contract.constructionUnit,
            arrivalDate: commissionDate,
            samplingDate: commissionDate,
            curingCondition: "自然养护",
            age: "",
            ext: {},
            remark: "",
            createdAt: "",
            updatedAt: "",
          });
        }
        if (doTest && firstParam && sampleId) {
          const firstStd = judgmentBasis[0] ?? testingBasis[0] ?? "";
          testRecords.push({
            id: `TR-FM-${pad}`,
            tenantId: TENANT,
            sampleId,
            parameterCode: firstParam,
            standardCode: firstStd,
            requirementCode: "",
            requirement: `${paramName(firstParam)} 符合${firstStd}要求`,
            // data_entry 单据录入中（结果留空）；review 起已有结论
            result: stageIdx === DATA_ENTRY_IDX ? "" : "符合",
            verdict: stageIdx === DATA_ENTRY_IDX ? "" : "合格",
            createdAt: "",
            updatedAt: "",
          });
        }
      }
    }
  }

  return { receipts, samples, testRecords };
}
