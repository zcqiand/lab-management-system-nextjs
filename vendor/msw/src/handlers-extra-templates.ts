// 报告模板 HTTP endpoint（msw 端：浏览器 + node 都用，handler 用 readTemplate
// 读 docx bytes + inject.json）。
//
// 与 handlers-extra.ts 分离：templates/index.ts 顶层 import 了 node:fs/promises，
// 在 browser bundle 里会触发 "node:fs/promises has been externalized" 错误。
// 把 templates 相关的 handler 移到这里 + handlers-array.ts 动态 import
// （node 端 setup 时才用，browser 不走这条 path），让 browser bundle 不带
// node:fs 依赖。
//
// 用法（node setupServer）：
//   import { templatesExtraHandlers } from "./handlers-extra-templates";
//   setupServer(...otherHandlers, ...templatesExtraHandlers)
//
// 用法（browser setupWorker）：不 import templatesExtraHandlers，让 browser
// 走 /api/templates/* → 404。lab-react/vue 仓的浏览器走各自的
// data/templates/ + import.meta.glob 读 docx（不在 msw 仓）。
import { http, HttpResponse } from "msw";
import { readTemplate, TEMPLATE_PATHS, TemplateNotFoundError } from "./templates/index";

const BASE = "/api";

function notFound(message: string) {
  return HttpResponse.json({ code: "NOT_FOUND", message }, { status: 404 });
}

export const templatesExtraHandlers = [
  // 列表：返回 name + reportNameCode（从 injectJson 抽，没有就 null）+ hasSidecar
  http.get(`*${BASE}/templates`, async () => {
    const items = await Promise.all(
      Object.keys(TEMPLATE_PATHS).map(async (name) => {
        try {
          const { injectJson } = await readTemplate(name);
          const m = (injectJson ?? {}) as { reportNameCode?: string };
          return {
            name,
            reportNameCode: m.reportNameCode ?? null,
            hasSidecar: injectJson !== null,
          };
        } catch {
          return { name, reportNameCode: null, hasSidecar: false };
        }
      }),
    );
    return HttpResponse.json(items);
  }),

  // 单个：name 不在 TEMPLATE_PATHS → 404（TemplateNotFoundError 接住）。
  // 108_砂浆抗压强度检测报告 无 sidecar → 200，hasSidecar=false, cells=[]。
  http.get(`*${BASE}/templates/:name`, async ({ params }) => {
    const name = String(params.name);
    try {
      const { injectJson } = await readTemplate(name);
      if (injectJson === null) {
        return HttpResponse.json({
          name,
          mode: null,
          reportNameCode: null,
          comment: null,
          cells: [],
          hasSidecar: false,
        });
      }
      if (typeof injectJson !== "object") {
        return HttpResponse.json(
          { code: "BAD_INJECT_JSON", message: `injectJson for ${name} is not object` },
          { status: 500 },
        );
      }
      const m = injectJson as {
        mode?: string;
        reportNameCode?: string;
        comment?: string;
        cells?: unknown[];
      };
      return HttpResponse.json({
        name,
        mode: m.mode ?? null,
        reportNameCode: m.reportNameCode ?? null,
        comment: m.comment ?? null,
        cells: Array.isArray(m.cells) ? m.cells : [],
        hasSidecar: true,
      });
    } catch (err) {
      if (err instanceof TemplateNotFoundError) return notFound(err.message);
      throw err;
    }
  }),
];