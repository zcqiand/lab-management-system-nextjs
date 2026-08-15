import { FlowStagePage } from '@/features/flow-pipeline/FlowStagePage'

/** 报告归档——流程线最后环节（flowStatus='archived'）。提交后流程结束（已归档），可退回发放。 */
export function ReportArchivePage() {
  return (
    // @entry M03.F08.I01
    // @entry M03.F08.I04
    <FlowStagePage
      title="报告归档"
      stage="archived"
      submitLabel="归档"
      nextStageLabel="已归档"
      subtitle="归档后流程结束；如需回溯可退回报告发放"
      dataFn="M03.F08.I01"
      filterDataFn="M03.F08.I04"
      viewDataFn="M03.F08.I02"
      actionDataFn="M03.F08.I03"
    />
  )
}

export default ReportArchivePage
