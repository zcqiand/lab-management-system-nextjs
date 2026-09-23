import { inspectionCalculationMethods } from "@lab/management-system-msw/fixtures";
console.log("count:", inspectionCalculationMethods.length);
const keys = new Set<string>();
for (const r of inspectionCalculationMethods as any[]) Object.keys(r).forEach((k) => keys.add(k));
console.log("keys:", [...keys].sort().join(","));
const anyRow = (inspectionCalculationMethods as any[])[0];
console.log("row0:", JSON.stringify(anyRow).slice(0, 300));
