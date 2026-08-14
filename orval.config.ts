import { defineConfig } from "orval";

// orval config — produces TS api-client from shared OpenAPI.
// Source: ../lab-management-system-shared/generated/openapi/openapi.yaml
//
// client: 'axios-functions' — lab/saas-react 都靠 react-query 形态；但 nextjs 服务端组件
// 用 plain function（不挂 react hook）。'axios' 在 orval 7.5/7.21 都把 const 包在 IIFE 里，
// 'axios-functions' 是 orval 专门给"想用 named export 的 axios"的人准备的 client 类型。
export default defineConfig({
  lab: {
    input: "../lab-management-system-shared/generated/openapi/openapi.yaml",
    output: {
      mode: "split",
      target: "./src/api/endpoints/endpoints.ts",
      client: "axios-functions",
      override: { useDates: false },
    },
  },
});
