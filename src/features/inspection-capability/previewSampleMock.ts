// REF 同名文件移植（类型引用改 @/ 别名）。
import type { ParamModelProps } from "@/features/data-entry/models/types"
import type { InspectionParameter } from "@/types/api"
import type { InspectionTechnicalRequirement } from "@/types/inspection/inspection-technical-requirement"

/** 参数界面预览的最小输入：一行参数界面（componentPath + config + name）。 */
export interface PreviewInterfaceRow {
  name?: string
  componentPath?: string
  config?: Record<string, unknown> | null
}

/**
 * 为「参数界面预览」构造确定性 mock 录入卡入参：
 * - 合成一个占位参数（名称取界面名）；
 * - 给一条已核验技术要求（≥400），让自动评定路径也被渲染；
 * - calcRule.specimenCount 取 config.specimenCount（回退 3），驱动组数；
 * - readOnly=true + onChange noop：纯展示，不落库。
 * 确定性（不含随机/时间），便于快照与测试稳定。
 */
export function buildPreviewProps(row: PreviewInterfaceRow): ParamModelProps {
  const cfg = (row.config ?? undefined) as Record<string, unknown> | undefined
  const name = row.name ?? '预览参数'
  const parameter: InspectionParameter = {
    id: 'PREVIEW',
    code: 'PREVIEW',
    name,
    rawName: name,
    canonicalName: name,
    aliases: [],
    unit: typeof cfg?.unit === 'string' ? (cfg.unit as string) : undefined,
    sourceType: 'official',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  } as InspectionParameter
  const specimenCount = typeof cfg?.specimenCount === 'number' ? (cfg.specimenCount as number) : 3
  const techReq: InspectionTechnicalRequirement = {
    id: 'preview-req',
    inspectionObjectCode: 'PREVIEW',
    inspectionParameterCode: 'PREVIEW',
    judgmentStandardCode: 'GB/T 228.1-2021',
    valueType: 'numeric',
    comparison: '≥',
    minValue: 400,
    judgmentMode: 'automatic',
    verificationStatus: 'verified',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  } as InspectionTechnicalRequirement
  return {
    parameter,
    record: undefined,
    sampleId: 'preview-sample',
    standards: [],
    stdParams: [],
    techReqs: [techReq],
    config: cfg,
    calcRule: { specimenCount },
    crossRecord: undefined,
    onChange: () => {},
    readOnly: true,
  }
}
