// deploy 脚本与仓内 env 契约的 key 集合一致性（CI 防漂移不变量）。
//
// 背景（2026-08-28 线上漂移事故）：VPS lab.env 的唯一生产者是
// deploy/lab-management-system-nextjs.sh 的「自举 + append-if-missing 迁移链」，
// 它与仓内 env 契约之间没有任何检查。T10 把仓内拉齐到 16 key 时
// 脚本停在 7 key，线上缺 LAB_SAAS_SERVICE_* 等 9 个 key，菜单快照静默失败。
// 本测试锁死：脚本会写入的 key 集合 == .env.example 的 key 集合。
// 本地加 key 不同步 deploy 脚本（或反过来），CI 直接红。
//
// 基线是 .env.example（2026-08-28 起 .env.production gitignored，真值含
// secret 不进 git；新 clone/CI 上不存在，example 是进仓的 key 全集 SSOT）。
// suite 侧同语义检查：scripts/lib/envcheck.py check_deploy_parity（L0.5 门）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 解析 dotenv 文本为 key 集合（与 suite envcheck.parse_env 同规则：注释/空行/非法行跳过）。 */
function envKeys(text: string): Set<string> {
  const keys = new Set<string>();
  for (const line of text.split("\n")) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/.exec(stripped);
    if (m?.[1]) keys.add(m[1]);
  }
  return keys;
}

/**
 * 从 deploy 脚本提取它会写进 lab.env 的 key 全集。
 *
 * 脚本写 env 的途径只有三种，全覆盖：
 *   1. 自举 heredoc 块 printf 'KEY=%s\n'（首启生成）
 *   2. append-if-missing printf/printf 块（追加迁移）
 *   3. sed -i 原地改值（不改 key 集合，不需提）
 * 统一识别 printf 单引号格式串里的 ^KEY= 模式。
 */
function deployScriptKeys(text: string): Set<string> {
  const keys = new Set<string>();
  // printf 'KEY=%s\n' 与 printf 'KEY=\n'（含 printf 'KEY=%s\n' "$VAR" 变体）
  const printfRe = /printf\s+'([A-Za-z_][A-Za-z0-9_]*)=/g;
  for (const m of text.matchAll(printfRe)) {
    if (m[1]) keys.add(m[1]);
  }
  // append_if_missing KEY "val"（老 lab.env 迁移块）
  const appendRe = /^\s*append_if_missing\s+([A-Za-z_][A-Za-z0-9_]*)\s/gm;
  for (const m of text.matchAll(appendRe)) {
    if (m[1]) keys.add(m[1]);
  }
  return keys;
}

describe("deploy lab.env ↔ .env.example key parity", () => {
  // 基线 = 进仓的 .env.example;gitignored 的 .env.production 在本地存在时
  // 附加核对(有真值的机器上多一道保险),CI/新 clone 上缺席不炸。
  const envExample = readFileSync(join(REPO_ROOT, ".env.example"), "utf-8");
  const deployScript = readFileSync(
    join(REPO_ROOT, "deploy", "lab-management-system-nextjs.sh"),
    "utf-8",
  );

  it(".env.example 的 key 必须都被 deploy 脚本写入（本地加 key 必须同步教脚本）", () => {
    const envK = envKeys(envExample);
    const scriptK = deployScriptKeys(deployScript);
    const missing = [...envK].filter((k) => !scriptK.has(k));
    expect(missing, `deploy 脚本不会写入这些 key: ${missing.join(", ")}`).toEqual([]);
  });

  it("deploy 脚本写入的 key 必须都在 .env.example（脚本不得写仓内已删 key）", () => {
    const envK = envKeys(envExample);
    const scriptK = deployScriptKeys(deployScript);
    const extra = [...scriptK].filter((k) => !envK.has(k));
    expect(extra, `deploy 脚本写了仓内没有的 key: ${extra.join(", ")}`).toEqual([]);
  });

  it("本地存在 .env.production 时,其 key 集合与 .env.example 严格相等（gitignored 部署契约）", () => {
    const prodPath = join(REPO_ROOT, ".env.production");
    let prodText: string;
    try {
      prodText = readFileSync(prodPath, "utf-8");
    } catch {
      return; // gitignored 文件缺席(新 clone/CI)合法
    }
    const prodK = envKeys(prodText);
    const envK = envKeys(envExample);
    const missing = [...envK].filter((k) => !prodK.has(k));
    const extra = [...prodK].filter((k) => !envK.has(k));
    expect(
      missing.length + extra.length === 0,
      `.env.production 与 .env.example key 集合漂移: 缺 ${missing.join(", ")}; 多 ${extra.join(", ")}`,
    ).toBe(true);
  });

  it("LAB_SSO_PROFILE 枚举值合法（no-sso | real，历史值 sso 是非法枚举）", () => {
    const m = /^LAB_SSO_PROFILE=(.+)$/m.exec(envExample);
    expect(m, ".env.example 必须显式声明 LAB_SSO_PROFILE").toBeTruthy();
    expect(["no-sso", "real"]).toContain((m?.[1] ?? "").trim());
  });
});
