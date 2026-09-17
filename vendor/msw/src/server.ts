// lab-msw HTTP 后端服务入口（ADR-0012 B 强度 / M99.F03）
// dotenv 必须在第一行：JWT_* fail-fast（jwt-signer）与 LAB_CORS_ALLOWED_ORIGINS
// 都在启动点读 env。2026-09-13 修复：本仓此前无 dotenv 接线，e2e CI 的
// `cp .env.example .env` 一直是死代码（JWT 四件套从未被加载）。
// 2026-09-13 用户裁定：msw 有 prod 端 lab-msw.xiangru.uk（部署链照 saas-msw 模式）。
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createMiddleware } from '@mswjs/http-middleware'
import { handlers } from './handlers-array'
import { resetFixtures } from './fixtures/seed'

const PORT = Number(process.env.PORT ?? 5200)

// CORS 白名单走 env 契约 LAB_CORS_ALLOWED_ORIGINS（lab 家族后端同名 key：
// springboot application.yml / aspnetcore Program.cs 同名）。
// 2026-09-13 修复：此前硬编码 localhost dev 列表，prod 三前端域名跨源调 msw 全被拒。
// 禁 env 默认值兜底（CLAUDE.md §2）：key 缺失/为空 fail-fast，不允许字面量回退。
const rawOrigins = process.env.LAB_CORS_ALLOWED_ORIGINS ?? ''
const ALLOWED_ORIGINS = rawOrigins
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (ALLOWED_ORIGINS.length === 0) {
  console.error(
    'LAB_CORS_ALLOWED_ORIGINS env is required (comma-separated origin list; see .env.example)',
  )
  process.exit(1)
}

const app = express()
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return cb(null, true)
      }
      return cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  }),
)
app.use(express.json()) // body 解析后由 @mswjs/http-middleware 重建 Request
// E2E reset（ADR-0033 阶段三，镜像 saas-msw）：mock-server 专属调试端点——
// fixtures 内存还原到启动快照。必须挂在 createMiddleware 之前：
// 501 兜底(http.all */api/v1/*)会截走未匹配请求。
app.post('/api/v1/__e2e/reset', (_req, res) => {
  resetFixtures()
  res.json({ ok: true, reset: true })
})

app.use(createMiddleware(...handlers)) // ★ 核心：handlers 零修改

// 健康检查（容器探活 + 显式 mode 标识防止被当 staging）
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, mode: 'msw', uptime: process.uptime() })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[lab-msw] mock http server listening on :${PORT} (mode=msw)`)
})
