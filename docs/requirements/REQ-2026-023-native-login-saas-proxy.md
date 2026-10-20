# REQ-2026-023 原生登录代理 saas IdP（家族 REQ 本仓验收记录）

> 本文档是家族级 REQ-2026-023 的**本仓验收留痕**。需求全文、方案人裁与实施过程记录的真源在
> shared 仓 `lab-management-system-shared/docs/requirements/REQ-2026-023-native-login-saas-proxy.md`，
> 本仓不复制正文，只登记与本仓相关的验收事实。

| 项 | 值 |
|---|---|
| 提出人 | zcqiand（家族 REQ） |
| 提出日期 | 2026-10-11 |
| 优先级 | P0 |
| 状态 | 已验收 |
| 关联功能 | M01.F05.I06 原生登录 |
| 关联 ADR | — |

## 1. 需求描述（摘要）

非浏览器客户端密码通道：`POST /api/auth/native-login` 请求体账密调 saas `/api/v1/auth/login`
（clientId=`lab-management`），saas 4xx→401 INVALID_CREDENTIALS 不透传、5xx/不可达→502
SAAS_UNAVAILABLE，lab 自家 JWT 重签，LoginResponse 契约形状不变。LAB_AUTH_DEV_PASSWORD 全家族退役。

## 2. 本仓实施与验收事实（摘自 shared REQ §7 实施记录）

- 2026-10-11 T-1：本仓按 TDD 实现 native-login 代理，commit `147b6f6` + `bffc20c`，gate 绿。
- 2026-10-12 T-7：顺序 tag 部署链（v0.3.89-20261011）CI 绿；prod 探针本仓通过——有效账密 200
  （LoginResponse 形状全、富化真名）、错密码 401；终验：alice/dev123456 →
  `https://lab-nextjs.xiangru.uk/api/auth/native-login` 200。
- 2026-10-12 **AC-7 闭环：lab-flutter prod 浏览器原生登录人工验收通过**（用户确认
  alice/dev123456 登录 `https://lab-flutter.xiangru.uk` 成功）——家族七条验收标准全过，
  REQ-2026-023 交付完成。

## 3. GA 记账说明

本仓测试锚定：`tests/api/auth-native-login-proxy.test.ts`（代理 200/401、出站 LoginRequest 形状、
租户富化降级、菜单快照不回归）。M01.F05.I06 于 2026-10-19 由开发中翻已上线（mirror 免批③，
凭本文档 §2 验收事实）。
