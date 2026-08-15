// Task 8 预植版只注册 default 卡；Task 10 补全 12 卡注册（算法域模块已从
// lab-management-system-shared/mocks/domain 逐字拷入本目录，见 cement-strength /
// rebar-mechanics / rebar-welding 三个文件的来源注释）。
// resolveParamInterfaceModel 对未注册 key 回退 DefaultParamCard（与 REF「白名单之外走 default」语义一致）。
import type { ParamModelComponent } from './types'
import { DefaultParamCard } from './DefaultParamCard'
import { ConcreteCompressCard } from './ConcreteCompressCard'
import { ConcretePermeabilityCard } from './ConcretePermeabilityCard'
import { CementFlexuralCard } from './CementFlexuralCard'
import { CementCompressCard } from './CementCompressCard'
import { RebarWeldingTensileCard } from './RebarWeldingTensileCard'
import { RebarWeldingBendCard } from './RebarWeldingBendCard'
import { RebarMechNumericCard } from './RebarMechNumericCard'
import { ParticleGradationCard } from './ParticleGradationCard'
import { SoilCompactionCard } from './SoilCompactionCard'
import { SoilCompactionDegreeCard } from './SoilCompactionDegreeCard'

export const MODEL_REGISTRY: Record<string, ParamModelComponent> = {
  default: DefaultParamCard,
  'concrete-compress': ConcreteCompressCard,
  'concrete-permeability': ConcretePermeabilityCard,
  'cement-flexural': CementFlexuralCard,
  'cement-compress': CementCompressCard,
  'rebar-welding-tensile': RebarWeldingTensileCard,
  'rebar-welding-bend': RebarWeldingBendCard,
  'rebar-mech-numeric': RebarMechNumericCard,
  'particle-gradation': ParticleGradationCard as unknown as ParamModelComponent,
  'soil-compaction': SoilCompactionCard,
  'soil-compaction-degree': SoilCompactionDegreeCard,
}

export function resolveParamInterfaceModel(key?: string): ParamModelComponent {
  return (key && MODEL_REGISTRY[key]) || DefaultParamCard
}
