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
export default defineConfig({
  lab: {
    input: "../lab-management-system-shared/generated/openapi/openapi.yaml",
    output: {
      mode: "split",
      target: "./src/api/endpoints/endpoints.ts",
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
