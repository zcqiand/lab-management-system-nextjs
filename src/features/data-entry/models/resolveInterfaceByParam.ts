import type { ParamInterfaceRow, ParamInterfaceLink } from '@/types/common'

/**
 * 把「参数↔界面」关联派发成「参数 → 界面组件」查找表。
 *
 * 规则：
 * - 报告作用域优先：命中当前报告（categoryCode）的关联胜出；
 *   否则用无作用域（通用）关联；两者皆无 → 该参数不出现，由调用方 fallback 到 default 界面。
 * - 同一作用域内绑多个界面 → 取 sortOrder 最小者；
 * - link 指向不存在的界面 → 忽略。
 *
 * 之所以要按 categoryCode 作用域派发：同一参数（如抗拉强度 IP-0087）在
 * 「钢筋力学性能 / 机械连接 / 焊接接头」三类报告里要走不同录入卡，全局单卡无法表达。
 */
export function resolveInterfaceByParam(
  interfaces: ParamInterfaceRow[],
  links: ParamInterfaceLink[],
  categoryCode?: string,
): Record<string, { componentPath: string; config?: Record<string, unknown> }> {
  const byCode = new Map(interfaces.map((i) => [i.code, i]))
  const byParam = new Map<string, ParamInterfaceLink[]>()
  for (const l of links) {
    if (!byCode.has(l.inspectionParamInterfaceCode)) continue
    const arr = byParam.get(l.inspectionParameterCode) ?? []
    arr.push(l)
    byParam.set(l.inspectionParameterCode, arr)
  }
  const out: Record<string, { componentPath: string; config?: Record<string, unknown> }> = {}
  for (const [paramCode, list] of byParam) {
    const scoped = categoryCode ? list.filter((l) => l.reportNameCode === categoryCode) : []
    const generic = list.filter((l) => !l.reportNameCode)
    // 命中报告作用域优先；否则退回通用（无作用域）关联；外报告作用域的关联不作兜底，避免串卡。
    const pool = scoped.length ? scoped : generic
    if (pool.length === 0) continue
    const best = pool
      .map((l) => byCode.get(l.inspectionParamInterfaceCode))
      .filter((i): i is ParamInterfaceRow => !!i)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    if (best) {
      // 链接上的 config（如 gravel/sampleRows）优先，参数本身 config 作 fallback
      const linkConfig = pool.find(
        (l) => byCode.get(l.inspectionParamInterfaceCode)?.code === best.code,
      )?.config
      const config = linkConfig ?? best.config
      out[paramCode] = { componentPath: best.componentPath, config }
    }
  }
  return out
}
