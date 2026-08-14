# docs/conventions/nextjs.md

> 读我之前先看 CLAUDE.md 的禁止事项，那里写了 exit code 能强制的事。
> 本目录是不进主上下文的细则，逻辑/性能类规则放这里，配合 skill 引用。

## Server vs Client 组件

Next.js App Router 默认全是 server component。加 `'use client';` 才进入客户端 bundle。

判断顺序：

1. 有 useState / useEffect / useRef / useReducer / 浏览器 API（window, document, localStorage）→ `'use client';`
2. 渲染 Radix UI（Dialog / Select / DropdownMenu / Checkbox / ...）→ `'use client';`
3. 渲染其他标注了 `'use client'` 的组件 → 跟着标注，否则保留 server
4. 仅做静态展示 / 数据拼接 / 服务端数据获取 → server，不要写 `'use client'`

page.tsx / layout.tsx 默认是 server，把交互下沉到 `*-client.tsx` 子组件。

## 数据获取：Route Handler vs Server Action

| 用途 | 走法 |
|---|---|
| 列表查询、过滤、详情 | `src/app/api/.../route.ts` —— GET，客户端 `fetch()` 或 RSC 直读 |
| 表单提交、状态变更 | Server Action（`'use server'`） —— 表单直接接 action，零路由表 |
| 第三方 webhook / 公开 API | Route Handler 在 `app/api/webhooks/.../route.ts` |
| 流式响应（SSE / 长连接） | Route Handler 用 ReadableStream 返回 |

数据库调用必须落在 server only。`src/db/index.ts` 顶部加了 `import 'server-only';`，编译期就能阻止 client 文件误 import。

## Drizzle + SQLite

数据访问层在 `src/db/` 下：

- `schema.ts` —— 全部表的类型化定义。改完跑 `npm run db:generate` 让 drizzle-kit 出迁移
- `index.ts` —— 一个 `db` 实例，harness 与 route 都从这里取

链式 query builder 的形态：

```ts
import { db } from "@/db";
import { projects, sql } from "drizzle-orm";

const items = db
  .select({ id: projects.id, name: projects.name })
  .from(projects)
  .where(eq(projects.status, "active"))
  .limit(20)
  .all();
```

`select` / `insert` / `update` / `delete` 都返回 builder，结尾用 `.get()` / `.all()` / `.run()` 落库。

### env

| 变量 | 默认 | 何时改 |
|---|---|---|
| `DB_PATH` | `data/dev.db` | 测试 = `:memory:`（vitest 已自动注入）；CI 也常换成临时路径 |
| `TRACE_MAP` | （空） | 设 `=1` 才会产出 `.state/trace.json` |

### 改 schema 的步骤

1. `src/db/schema.ts` 加列或新表
2. `npm run db:generate` —— 生成 `drizzle/000N_xxx.sql`
3. **不要**手改 `drizzle/000N_*.sql`；如果想修初始 SQL，改完 schema 重新 generate
4. `npm run db:migrate` 应用到 `data/dev.db`
5. 提交时连同 `drizzle/meta/_journal.json` 一并提交（迁移元数据要进版本控制）

## Server Action 模式

```ts
// src/app/projects/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { projects } from '@/db/schema';

export async function createProject(formData: FormData) {
  const name = formData.get('name')?.toString() ?? '';
  // ... 校验
  db.insert(projects).values({ name }).run();
  revalidatePath('/projects');
}
```

调用方可以：

```tsx
<form action={createProject}>  {/* 直接接，无 JS 也能跑 */}
  ...
</form>
```

或 `useActionState` 做受控 loading / 错误态。

## Route Handler 模式

```ts
// src/app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const items = db
    .select()
    .from(projects)
    .where(like(projects.name, `%${q}%`))
    .all();
  return NextResponse.json({ items });
}
```

约定：

- 单数资源：`src/app/api/projects/[id]/route.ts`（动态段）
- 列表静态可缓存的：route handler 顶部 `export const revalidate = 60;`
- 鉴权：要么走 middleware（推荐），要么每条 handler 显式 `await auth()`

## 不要做的事

1. 不要在 client 文件里 `import { db }` 或 `import '@/db'` —— `server-only` 标记编译期会报红
2. 不要在 server component 里调 useState / useEffect —— 编译期报错
3. 不要把 server action 写在 client 文件里，必须 top-level 文件头部 `'use server'`
4. 不要在多个 route handler 里反复 `new Database(...)` —— 用 `@/db` 单例
5. 不要忽略 .next/types 报红 —— `next dev` 没跑过 types 是缺失的，不是失效的
6. 不要把 env 直接打印到 client bundle（`process.env` 在 client 端是 undefined 之外还会被替换，私密信息写到 `NEXT_PUBLIC_` 之外的变量名）
7. 不要在改完 schema.ts 后手写 `drizzle/*.sql`；迁移必须由 `npm run db:generate` 出
