// Public API surface for @lab/management-system-msw
// Note: setupNodeMocks is NOT re-exported here — it pulls msw/node which fails
// to bundle in browser environments. Import directly from
// "@lab/management-system-msw/node" if you need it (test setup only).
// ADR-0012 + v0.3.0: Service Worker mode 完全删除（msw/browser 不再 re-export）；
// 浏览器侧 MSW 走 @mswjs/http-middleware 起的独立 HTTP server（src/server.ts）。
export { handlers } from "./handlers-array";
export {
  default as fixtures,
  contracts,
  sampleReceipts,
  samples,
  testRecords,
  inspectionBrands,
  inspectionModels,
  inspectionSpecs,
  inspectionGrades,
  technicalRequirements,
  inspectionSpecialties,
  inspectionObjects,
  inspectionParameters,
  inspectionStandards,
  inspectionCalculationMethods,
  getContract,
  getReceipt,
  getSample,
  getTestRecord,
} from "./fixtures/seed";
