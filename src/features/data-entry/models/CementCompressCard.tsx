import { useCallback } from 'react'
import type { ParamModelProps } from './types'
import { StrengthCardBase } from './StrengthCardBase'
import { computeCementCompress, type StrengthResult } from './cement-strength'

/**
 * 水泥胶砂抗压强度卡：6 试件破坏荷载(kN) → 抗压强度(MPa, Rc=F/A) → ±10% 剔除均值 → 单项评定。
 * config：{ specimenCount=6, area=1600 }。
 */
export function CementCompressCard(props: ParamModelProps) {
  const specimenCount = (props.config?.specimenCount as number) ?? 6
  const area = (props.config?.area as number) ?? 1600
  const compute = useCallback(
    (loads: number[]): StrengthResult => computeCementCompress(loads, area),
    [area],
  )
  return (
    <StrengthCardBase
      {...props}
      specimenCount={specimenCount}
      compute={compute}
      strengthLabel="抗压强度 (MPa)"
    />
  )
}

export default CementCompressCard
