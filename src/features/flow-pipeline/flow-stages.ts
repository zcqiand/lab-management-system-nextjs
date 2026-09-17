// 流程管线 UI 常量（M03）——2026-09-17 TSOT 清理 Phase C2：src/types/ 手写平行类型
// 全量删除，实体类型改 import orval 生成物（src/api/endpoints/model/）。
// FLOW_STAGE_ORDER / FLOW_STAGE_LABELS 是纯 UI 常量（顺序 + 中文名），契约里没有，
// 落在消费最集中的 flow-pipeline 特性目录；阶段值类型用 orval 的 FlowStatus。
import type { FlowActionRequest, FlowActionResult, FlowStatus } from "@/api/endpoints/model";
import { receiptsActFlowApprove } from "@/api/endpoints/receipts/receipts";
import { receiptsActFlowArchived } from "@/api/endpoints/receipts/receipts";
import { receiptsActFlowAssigning } from "@/api/endpoints/receipts/receipts";
import { receiptsActFlowDataEntry } from "@/api/endpoints/receipts/receipts";
import { receiptsActFlowIssuance } from "@/api/endpoints/receipts/receipts";
import { receiptsActFlowReceiving } from "@/api/endpoints/receipts/receipts";
import { receiptsActFlowReview } from "@/api/endpoints/receipts/receipts";

/** 流程阶段顺序（前进 = 提交，后退 = 退回/撤回） */
export const FLOW_STAGE_ORDER: FlowStatus[] = [
  "receiving",
  "task_assignment",
  "data_entry",
  "review",
  "approval",
  "issuance",
  "archived",
  "completed",
];

/** 流程阶段中文名 */
export const FLOW_STAGE_LABELS: Record<FlowStatus, string> = {
  receiving: "接样中",
  task_assignment: "分配中",
  data_entry: "录入中",
  review: "审核中",
  approval: "批准中",
  issuance: "发放中",
  archived: "归档中",
  completed: "已归档",
};

/** 7 阶段 act 端点生成函数签名（body/response 与契约 FlowActionRequest/FlowActionResult 对齐） */
type ActFn = (body: FlowActionRequest) => Promise<FlowActionResult[]>;

/**
 * 页面 stage（FlowStatus）→ 对应的 7 阶段 act 端点生成函数
 * （M03 7 阶段全 act 模式，ADR-0035；后端按路径 stage 做 stage-guard——
 * 单据必须停在该阶段才能 submit/return）。completed 是终态展示值，无 act 端点。
 */
export const ACT_BY_STAGE: Record<Exclude<FlowStatus, "completed">, ActFn> = {
  receiving: receiptsActFlowReceiving,
  task_assignment: receiptsActFlowAssigning,
  data_entry: receiptsActFlowDataEntry,
  review: receiptsActFlowReview,
  approval: receiptsActFlowApprove,
  issuance: receiptsActFlowIssuance,
  archived: receiptsActFlowArchived,
};
