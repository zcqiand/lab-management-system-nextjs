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
