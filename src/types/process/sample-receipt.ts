import type { FlowStage, FlowHistoryEntry } from './flow';

/**
 * 接样单（M03.F01）——接样表与报告表合并为一张表。
 * 领域主链：合同 Contract → 接样单 SampleReceipt → 样品 Sample → 单项检测记录 TestRecord。
 */

export interface SampleReceipt {
  /** 内部主键（uuid）。 */
  id: string;
  /** 关联合同 id（FK → Contract.id）。 */
  contractId: string;
  /** 委托书编号，业务可读编码。 */
  commissionCode: string;
  /** 委托日期。 */
  commissionDate: string;
  /** 委托书登记号（部分机构对委托书做登记）。 */
  commissionRegisterCode?: string;
  /** 委托书登记日期。 */
  commissionRegisterDate?: string;
  /** 报告名称编码（FK → InspectionReportName.code），决定样品扩展属性、报告模板与汇总口径。 */
  categoryCode: string;
  /** 工程名称（从合同带出，可手工覆盖）。 */
  projectName?: string;
  /** 委托单位（从合同带出）。 */
  clientUnit?: string;
  /** 建设单位（从合同带出）。 */
  buildingUnit?: string;
  /** 监理单位（从合同带出）。 */
  supervisorUnit?: string;
  /** 施工单位（从合同带出）。 */
  constructionUnit?: string;
  /** 见证单位（从合同带出）。 */
  witnessUnit?: string;
  /** 取样地点。 */
  samplingLocation?: string;
  /** 见证人姓名。 */
  witness?: string;
  /** 见证人电话。 */
  witnessPhone?: string;
  /** 送检人姓名。 */
  inspector?: string;
  /** 送检人电话。 */
  inspectorPhone?: string;
  /** 接样人（系统记录的操作人员）。 */
  receivedBy: string;
  /** 样品来源（如「施工送检」「监督抽检」「委托送样」）。 */
  sampleSource: string;
  /** 检测类别（如「委托检验」「监督检验」「仲裁检验」）。 */
  testCategory: string;
  /** 检测环境（在数据录入环节维护）。 */
  testEnvironment?: string;
  /** 主要检测设备（在数据录入环节维护）。 */
  mainEquipment?: string;
  /** 检测人员（在数据录入环节维护）。 */
  testOperator?: string;
  /** 检测开始日期（在数据录入环节维护）。 */
  testStartDate?: string;
  /** 检测结束日期（在数据录入环节维护）。 */
  testEndDate?: string;
  /** 原始记录单号（在数据录入环节维护）。 */
  originalRecordNo?: string;
  /** 备注（在数据录入环节维护）。 */
  remark?: string;
  /** 判定依据：检测标准编码数组（FK → TestStandard.code，role=JUDGMENT 语义）。 */
  judgmentBasis?: string[];
  /** 检测依据：检测标准编码数组（FK → TestStandard.code，role=TESTING 语义）。 */
  testingBasis?: string[];
  /** 检测参数编码数组（按判定依据∪检测依据过滤得到）。 */
  testParameters?: string[];
  // ----- 流程管线 -----
  /** 当前流程阶段。 */
  flowStatus: FlowStage;
  /** 流程操作历史。 */
  flowHistory: FlowHistoryEntry[];
  /** 最近一次提交的操作人（撤回权限校验：仅提交人可撤回）。 */
  lastSubmittedBy: string | null;
  /** 任务安排：检测人员 id。 */
  assigneeId?: string;
  /** 任务安排：检测人员姓名。 */
  assigneeName?: string;
  /** 任务安排：计划检测日期。 */
  plannedTestDate?: string;
  // ----- 合并自报告表 -----
  /** 报告编号（报告编制环节生成）。 */
  reportCode?: string;
  /** 报告日期（报告编制环节维护）。 */
  reportDate?: string;
  /** 检测结论（报告编制环节维护）。 */
  conclusion?: string;
  /** 判定结果：pass=合格 / fail=不合格 / ''=未评定。 */
  result?: 'pass' | 'fail' | '';
  /** 报告签发时间。 */
  issuedAt?: string | null;
  /** 创建时间。 */
  createdAt: string;
  /** 更新时间。 */
  updatedAt: string;
}