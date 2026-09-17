import { defineConfig } from "orval";
export default defineConfig({
  msw: {
    input: "../lab-management-system-shared/generated/openapi/openapi.yaml",
    output: {
      mode: "split",
      target: "./src/handlers.msw.ts",
      mock: {
        type: "msw",
        generateEachHttpStatus: false,
        baseURL: "http://localhost:5173",
      },
    },
  },
});
