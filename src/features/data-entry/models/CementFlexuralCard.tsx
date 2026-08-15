import { useCallback } from 'react'
import type { ParamModelProps } from './types'
import { StrengthCardBase } from './StrengthCardBase'
import { computeCementFlexural, type StrengthResult } from './cement-strength'

/**
 * 水泥胶砂抗折强度卡：3 试件破坏荷载(kN) → 抗折强度(MPa, Rf=1.5·F·L/b³) → ±10% 剔除均值 → 单项评定。
 * config：{ specimenCount=3, span=100, width=40 }。
 */
export function CementFlexuralCard(props: ParamModelProps) {
  const specimenCount = (props.config?.specimenCount as number) ?? 3
  const span = (props.config?.span as number) ?? 100
  const width = (props.config?.width as number) ?? 40
  const compute = useCallback(
    (loads: number[]): StrengthResult => computeCementFlexural(loads, span, width),
    [span, width],
  )
  return (
    <StrengthCardBase
      {...props}
      specimenCount={specimenCount}
      compute={compute}
      strengthLabel="抗折强度 (MPa)"
    />
  )
}

export default CementFlexuralCard
