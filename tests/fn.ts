import { test as base } from "vitest";

// 扩展 vitest 的 TaskMeta，让 fn 成为一等类型。
// 不用 any 绕过 —— 适配器不能豁免于它所服务的规则。
declare module "vitest" {
  interface TaskMeta {
    fn?: string[];
  }
}

/**
 * 声明该测试验证的功能子项 ID。
 *
 * 契约：被 skip 的测试不会执行，meta 就永远写不进去 —— 假绿在物理上不可能发生。
 * 这不是靠纪律，是靠机制。
 *
 *   fnTest(["M01.F01.I03"], "超出宽限判定为迟到", () => { ... });
 *
 * 纪律部分（机器管不了的）：
 *   - 只在测试直接验证该子项可观察行为时才挂 ID
 *   - 间接受益不挂
 *   - 工程设施的测试不挂任何业务 ID
 *   - 一个测试挂 3 个以上 ID，通常说明它测得太宽
 *
 * 不要为「这个测试在 CI 上跳过了」找借口写注册 ID 的 helper（曾有 fnTestIf，
 * 已撤：fake coverage 比 skip 不报的危害更大 —— 真正的事实是「该 ID 没有运行过的测试」，
 * 那是真实的覆盖缺口，应通过补真实断言（源码级 / beforeAll emit）解决，不是绕过机制）。
 */
export function fnTest(ids: string[], name: string, body: () => void | Promise<void>) {
  return base(name, (ctx) => {
    ctx.task.meta.fn = ids;
    return body();
  });
}
