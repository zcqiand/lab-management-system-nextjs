import { FlowStagePage } from '@/features/flow-pipeline/FlowStagePage'

/** 报告发放——流程线第六环节（flowStatus='issuance'）。仅走流程：提交=发放进入归档，退回批准。 */
export function ReportIssuePage() {
  return (
    // @entry M03.F07.I01
    // @entry M03.F07.I04
    <FlowStagePage
      title="报告发放"
      stage="issuance"
      submitLabel="发放"
      dataFn="M03.F07.I01"
      filterDataFn="M03.F07.I04"
      viewDataFn="M03.F07.I02"
      actionDataFn="M03.F07.I03"
    />
  )
}

export default ReportIssuePage
