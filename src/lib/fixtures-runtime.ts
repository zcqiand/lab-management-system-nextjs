// Next.js 每个 App Router 路由独立打包，直接 import 的
// @lab/management-system-msw/fixtures 内存数组会在不同路由 bundle 里
// 实例化成多份副本（REQ-2026-001 live 四方实证：POST /api/param-interfaces
// 建行 201 后，[code] 路由 DELETE 同 code 404——写进了另一份副本）。
// 用 globalThis 单例保证同一 server 进程内所有路由共享同一份 fixtures 引用。
//
// ⚠️ 凡跨路由有写读关系的契约路由（POST + [code] PUT/DELETE + /links），
// 必须经此单例取数组，不得直接 import fixtures。
import * as fixtures from "@lab/management-system-msw/fixtures";

const g = globalThis as unknown as { __labFixturesSingleton?: typeof fixtures };

export const fixturesSingleton: typeof fixtures = (g.__labFixturesSingleton ??= fixtures);

// —— 计算方法 / 技术要求（复合键域）共享访问器 ——
// T11(2026-09-16)：calc-methods / tech-req 的 POST 写 list 路由 bundle 的 fixtures
// 数组副本，[id] 与复合键路由读的是另一份副本 → PUT/DELETE 恒 404。与 snapshots
// 同理，读写一律经上方 fixturesSingleton（globalThis 真·进程级单例）。
export type FixtureRow = Record<string, unknown>;

export function calcMethodArr(): FixtureRow[] {
  return fixturesSingleton.inspectionCalculationMethods as unknown as FixtureRow[];
}

export function techReqArr(): FixtureRow[] {
  return fixturesSingleton.technicalRequirements as unknown as FixtureRow[];
}

export function calcMethodId(r: FixtureRow): string {
  return String(r["id"] ?? `cr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}`);
}

export function techReqId(r: FixtureRow): string {
  return String(
    r["id"] ??
      `tr-${r["inspectionObjectCode"]}-${r["inspectionParameterCode"]}-${r["judgmentStandardCode"]}`,
  );
}
