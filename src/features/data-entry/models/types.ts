import type { ReactElement } from 'react'
import type { InspectionParameter } from '@/types/api'
import type { TestRecord } from '@/types/process/test-record'
import type { InspectionStandard } from '@/types/inspection/inspection-standard'
import type { InspectionStandardParameter } from '@/types/inspection/inspection-standard-parameter'
import type { InspectionTechnicalRequirement } from '@/types/inspection/inspection-technical-requirement'

/**
 * 钢筋力学性能「比值卡」（强屈比/超强比）跨记录联立入参：
 * 强屈比[i] = tensileStrengths[i] / yieldStrengths[i]；
 * 超强比[i] = yieldStrengths[i] / specStandardYield（标准屈服值 = IP-0086 技术要求 minValue）。
 * 由 EntryModal 从同一样品已保存的 IP-0087/IP-0086 记录 + 技术要求解析而来；缺值时卡片回退手动录入。
 */
export interface CrossRecordInput {
  tensileStrengths?: number[]
  yieldStrengths?: number[]
  specStandardYield?: number
}

/** 所有参数界面模型组件的统一契约。组件只渲染 + 上报改动，不直接 fetch / 不落库。 */
export interface ParamModelProps {
  parameter: InspectionParameter
  record: TestRecord | undefined
  /** 当前选中的样品 id——模型卡用此区分不同样品的本地状态（如混凝土抗压的 loads）。 */
  sampleId: string
  standards: InspectionStandard[]
  stdParams: InspectionStandardParameter[]
  techReqs: InspectionTechnicalRequirement[]
  config: Record<string, unknown> | undefined
  /**
   * 该参数的计算规则（M06.F05，按项目+参数+检测依据）。仅取 specimenCount 驱动「做几组数据」。
   * 缺省时卡片回退 config.specimenCount 或内置默认值。
   */
  calcRule?: { specimenCount: number }
  /** 比值卡（强屈比/超强比）的跨记录联立入参；非比值卡忽略。 */
  crossRecord?: CrossRecordInput
  /** 把改动上报给父组件（EntryModal）合并入 dirty 缓冲，由保存按钮统一落库。 */
  onChange: (patch: Partial<TestRecord>) => void
  /**
   * 只读模式（详情页「检测数据」用）：
   * - true：所有输入/select 灰化 + onChange 被吞掉
   * - 默认 false（数据录入弹窗）
   */
  readOnly?: boolean
}

export type ParamModelComponent = (props: ParamModelProps) => ReactElement
