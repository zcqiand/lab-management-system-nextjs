import { FlowStagePage } from '@/features/flow-pipeline/FlowStagePage'

/** 报告审核——流程线第四环节（flowStatus='review'）。仅走流程：提交=审核通过进入批准，退回数据录入。 */
export function ReportReviewPage() {
  return (
    // @entry M03.F05.I01
    // @entry M03.F05.I04
    <FlowStagePage
      title="报告审核"
      stage="review"
      submitLabel="审核通过"
      subtitle="审核通过后进入报告批准"
      dataFn="M03.F05.I01"
      filterDataFn="M03.F05.I04"
      viewDataFn="M03.F05.I02"
      actionDataFn="M03.F05.I03"
    />
  )
}

export default ReportReviewPage
