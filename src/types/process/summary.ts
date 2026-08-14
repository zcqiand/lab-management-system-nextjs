import type { FlowStage } from './flow';

/**
 * 统计（M05 数据统计）——仪表盘 + 试验报告汇总表
 */

export interface DashboardStats {
  contractCount: number;
  receiptCount: number;
  sampleCount: number;
  /** 由接样单 flowStatus 推导（draft=审核前阶段 / reviewing=审核+批准 / issued=发放+归档） */
  reportCountByStatus: { draft: number; reviewing: number; issued: number };
  /** 处于「任务安排」阶段的接样单数量 */
  pendingTaskCount: number;
  /** 各流程阶段的接样单数量 */
  receiptCountByStage: Record<FlowStage, number>;
  /** 各报告类别的接样单数量与已出报告数 */
  receiptCountByCategory: { categoryCode: string; categoryName: string; count: number; reported: number }[];
}

export interface SummaryColumn {
  key: string;
  label: string;
}

/** 试验报告汇总表（对应各类汇总表：钢材/水泥/混凝土/砂/碎石/机械连接/焊接连接） */
export interface SummaryData {
  summaryName: string;
  columns: SummaryColumn[];
  rows: Record<string, string>[];
}

/** 钢材汇总表行 */
export interface SteelSummaryRow {
  seq: number;
  spec: string;
  steelGrade: string;
  qualityCertNo: string;
  manufacturer: string;
  representQuantity: string;
  reportCode: string;
  testDate: string;
  result: 'pass' | 'fail';
}