import type {
  ParamInterface as ParamInterfaceRow,
  ParamInterfaceLink,
} from "@/api/endpoints/model";

/**
 * 把「参数↔界面」关联派发成「参数 → 界面 schema」查找表（ADR-0056：
 * component_path 与 link.config 均已随契约退役，返回 interfaceCode + schema config + version）。
 *
 * 作用域特异性优先（2026-11-10 第二波裁定，不再引 sortOrder）：
 * 1. inspectionStandardCode 精确命中当前检测依据；
 * 2. reportNameCode 命中当前报告类别；
 * 3. 无作用域（通用）兜底。
 * 同层多条 → 取先登记者（稳定序）；link 指向不存在的界面 → 忽略；
 * 外报告作用域不作兜底，避免串卡。
 */
export interface ResolvedParamInterface {
  /** 界面 code（调试/预览用；渲染本身只认 config） */
  interfaceCode: string;
  /** 表单结构 schema（渲染器唯一输入） */
  config?: Record<string, unknown>;
  /** 表单结构版本 */
  version?: number;
}

export function resolveInterfaceByParam(
  interfaces: ParamInterfaceRow[],
  links: ParamInterfaceLink[],
  categoryCode?: string,
  standardCode?: string,
): Record<string, ResolvedParamInterface> {
  const byCode = new Map(interfaces.map((i) => [i.code, i]));
  const byParam = new Map<string, ParamInterfaceLink[]>();
  for (const l of links) {
    if (!byCode.has(l.paramInterfaceCode)) continue;
    const arr = byParam.get(l.inspectionParameterCode) ?? [];
    arr.push(l);
    byParam.set(l.inspectionParameterCode, arr);
  }
  const out: Record<string, ResolvedParamInterface> = {};
  for (const [paramCode, list] of byParam) {
    const stdMatched = standardCode
      ? list.filter((l) => l.inspectionStandardCode === standardCode)
      : [];
    const reportMatched = categoryCode
      ? list.filter((l) => l.reportNameCode === categoryCode)
      : [];
    const generic = list.filter((l) => !l.reportNameCode && !l.inspectionStandardCode);
    const pool = stdMatched.length
      ? stdMatched
      : reportMatched.length
        ? reportMatched
        : generic;
    if (pool.length === 0) continue;
    const link = pool[0];
    if (!link) continue;
    const best = byCode.get(link.paramInterfaceCode);
    if (!best) continue;
    out[paramCode] = {
      interfaceCode: best.code,
      config: best.config,
      version: best.version,
    };
  }
  return out;
}
