import { FlowStagePage } from '@/features/flow-pipeline/FlowStagePage'

/** 报告批准——流程线第五环节（flowStatus='approval'）。仅走流程：提交=批准进入发放，退回审核。 */
export function ReportApprovePage() {
  return (
    // @entry M03.F06.I01
    // @entry M03.F06.I04
    <FlowStagePage
      title="报告批准"
      stage="approval"
      submitLabel="批准"
      subtitle="批准后进入报告发放"
      dataFn="M03.F06.I01"
      filterDataFn="M03.F06.I04"
      viewDataFn="M03.F06.I02"
      actionDataFn="M03.F06.I03"
    />
  )
}

export default ReportApprovePage
