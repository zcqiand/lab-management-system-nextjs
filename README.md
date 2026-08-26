# lab-management-system-nextjs

建筑工程实验室管理系统 · Next.js 全栈前端（App Router）。

## 技术栈

Next.js 15 + App Router + TypeScript 5.7 + shadcn/ui + Tailwind v4。

完整说明见 [CLAUDE.md](CLAUDE.md)。

## Deepwiki MCP

本仓根目录的 `.mcp.json` 已注册 [Deepwiki](https://mcp.deepwiki.com/) MCP server（HTTP transport）。
Claude Code 启动时会自动加载，用于在多栈家族里查对端仓的官方文档。

常用工具：

- `read_wiki_structure` / `read_wiki_contents` —— 抓取 GitHub 仓库的官方文档结构与内容
- `ask_question` —— 针对任意仓库提问并返回引用过的答案

跨仓查文档时直接说：

> "用 deepwiki 查一下 lab-management-system-springboot 仓关于 JPA 实体定义的章节"

不需要时删除本仓根目录的 `.mcp.json` 即可关闭。

## 快速链接

- [CLAUDE.md](CLAUDE.md) — 入口、门禁、禁止事项
- [docs/](docs/) — 详细约定
- [.mcp.json](.mcp.json) — MCP server 注册