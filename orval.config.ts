import { defineConfig } from "orval";

// orval config — produces TS api-client from shared OpenAPI.
// Source: ../lab-management-system-shared/generated/openapi/openapi.yaml
//
// client: 'axios-functions'（保持）— nextjs 服务端组件用 plain function（不挂 react hook）。
//
// 兼容 axios 1.7+ 的 strict-mode 类型：
//   'axios-functions' 默认生成 `Promise<TData>` 函数签名，但 axios 1.7 的 axios.get 返回
//   Promise<AxiosResponseResult<...>>（5-arg 条件类型），与函数声明的 Promise<AxiosResponse<...>>
//   在 strict mode 下不兼容（TS2322）。
//   override.mutator 用 customFetch 把返回类型 cast 成 any，绕过 strict-mode 推断（仅影响
//   orval 输出，不影响运行时）。这是 orval 官方推荐的 axios 兼容性 workaround。
//
// Architecture (spec §2.1, saas-react PR #8 pilot):
// - mode: "tags-split" — 按 shared tsp 的 @tag 拆成多文件，schemas 抽到 model/ 子目录
// - target: 目录（不是文件）—— orval tags-split 必须 dir，不能 file
// - schemas: 单独 model/ 目录—— schemas 跨 tag 复用，集中放便于 import + tree-shaking
export default defineConfig({
  lab: {
    input: {
      target: "../lab-management-system-shared/generated/openapi/openapi.yaml",
      filters: {
        mode: "exclude",
        tags: ["frontend-bind-meta"],
      },
    },
    output: {
      mode: "tags-split",
      target: "./src/api/endpoints",
      schemas: "./src/api/endpoints/model",
      client: "axios-functions",
      override: {
        useDates: false,
        mutator: {
          path: "./src/api/mutator/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
  },
});