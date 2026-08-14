/**
 * 样品（M03）——归属接样单 receiptId
 * 字段 model / specification / grade / brand 维持 string FK 语义（指向 inspectionModelTable 等）；
 * 历史样品的旧字符串值（如 'HRB400'）按名匹配，无需数据迁移。
 */

export interface Sample {
  id: string;
  receiptId: string;
  sampleCode: string;
  sampleName?: string;
  /** 型号：热轧带肋 / P·O 42.5 / C30 / 中砂 / 直螺纹套筒 / 闪光对焊 */
  model?: string;
  /** 规格（尺寸/粒径/直径）：Φ22 / 150×150×150mm / 5-25mm；无尺寸的类别留空 */
  specification?: string;
  /** 等级：接头Ⅰ/Ⅱ/Ⅲ级、砂石Ⅰ/Ⅱ/Ⅲ类；型号已含等级的类别留空 */
  grade?: string;
  /** 牌号：HRB400 等 */
  brand?: string;
  /** 生产厂家 */
  manufacturer?: string;
  /** 结构部位 */
  structuralPart?: string;
  /** 代表数量 */
  representQuantity?: string;
  sampleQuantity?: string;
  /** 出厂编号/批号 */
  batchNumber?: string;
  /** 供销单位 */
  supplyUnit?: string;
  /** 进场日期 */
  arrivalDate?: string;
  /** 取（制）样日期 */
  samplingDate?: string;
  /** 养护条件 */
  curingCondition?: string;
  /** 龄期 */
  age?: string;
  /** 按报告类别 extFields 定义的扩展属性 */
  ext: Record<string, string>;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

/** 新建样品入参 */
export interface SampleCreateInput {
  receiptId: string;
  sampleCode: string;
  sampleName?: string;
  model?: string;
  specification?: string;
  grade?: string;
  brand?: string;
  manufacturer?: string;
  structuralPart?: string;
  representQuantity?: string;
  sampleQuantity?: string;
  batchNumber?: string;
  supplyUnit?: string;
  arrivalDate?: string;
  samplingDate?: string;
  curingCondition?: string;
  age?: string;
  ext?: Record<string, string>;
  remark?: string;
}

/** 更新样品入参（全量更新，同 create） */
export type SampleUpdateInput = SampleCreateInput;

/** 样品状态 */
export type SampleStatus = string;
export interface SampleQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: SampleStatus;
  projectId?: string;
  receiptId?: string;
}