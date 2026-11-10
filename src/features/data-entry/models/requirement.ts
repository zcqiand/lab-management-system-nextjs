// 技术要求展示文本（ADR-0056 从 DefaultParamCard 提炼；requirementCode 已随契约退役，
// TestRecord 只落 requirement 文本）。
import type { TechnicalRequirement as InspectionTechnicalRequirement } from "@/api/endpoints/model";

export function requirementLabel(r: InspectionTechnicalRequirement): string {
  const unit = r.unit ? ` ${r.unit}` : "";
  if (
    (r.valueType === "range" || r.comparison === "range") &&
    r.minValue != null &&
    r.maxValue != null
  )
    return `${r.minValue} ~ ${r.maxValue}${unit}`;
  if (r.comparison === "≥" && r.minValue != null) return `≥ ${r.minValue}${unit}`;
  if (r.comparison === "≤" && r.maxValue != null) return `≤ ${r.maxValue}${unit}`;
  if (r.targetValue)
    return `${r.comparison === "=" || r.comparison === "eq" ? "= " : ""}${r.targetValue}${unit}`;
  if (r.expression) return r.expression;
  const parts = [r.comparison, r.minValue ?? r.maxValue ?? r.targetValue]
    .filter(Boolean)
    .join(" ");
  return parts ? `${parts}${unit}` : r.remark || "—";
}
