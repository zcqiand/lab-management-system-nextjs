// Cross-frontend seed data — re-exports JSON-loaded tables from src/seeds/.
// MSW handlers re-export from src/handlers-array.ts (orval-generated + extra).
// Exposes mutable arrays (handlers write to them) + lookup helpers.

import type {
  Contract,
  MyTenant,
  SampleReceipt,
  Sample,
  TestRecord,
  CatalogEntry,
  TechnicalRequirement,
  InspectionSpecialty,
  InspectionObject,
  InspectionParameter,
  InspectionStandard,
  CalculationMethod,
  InspectionReportName,
  InspectionParamInterface,
  SpecialtyObjectLink,
  ObjectParameterLink,
  ObjectStandardLink,
  StandardParameterLink,
  ObjectReportNameLink,
  ReportNameStandardLink,
  ReportNameParameterLink,
  ParamInterfaceLink,
} from "../generated_ts_shim";
import {
  contracts as _contracts,
  tenants as _tenants,
  sampleReceipts as _sampleReceipts,
  samples as _samples,
  testRecords as _testRecords,
  inspectionBrands as _inspectionBrands,
  inspectionModels as _inspectionModels,
  inspectionSpecs as _inspectionSpecs,
  inspectionGrades as _inspectionGrades,
  technicalRequirements as _technicalRequirements,
  inspectionSpecialties as _inspectionSpecialties,
  inspectionObjects as _inspectionObjects,
  inspectionParameters as _inspectionParameters,
  inspectionStandards as _inspectionStandards,
  inspectionObjectParameters as _inspectionObjectParameters,
  inspectionObjectStandards as _inspectionObjectStandards,
  inspectionStandardParameters as _inspectionStandardParameters,
  inspectionSpecialtyObjects as _inspectionSpecialtyObjects,
  inspectionCalculationMethods as _inspectionCalculationMethods,
  inspectionReportNames as _inspectionReportNames,
  inspectionObjectReportNames as _inspectionObjectReportNames,
  inspectionReportNameStandards as _inspectionReportNameStandards,
  inspectionReportNameParameters as _inspectionReportNameParameters,
  inspectionParamInterfaces as _inspectionParamInterfaces,
  inspectionParamInterfaceLinks as _inspectionParamInterfaceLinks,
} from "../seeds";

// JSON imports are readonly at type level. Cast to mutable so handlers
// can push/splice. Runtime array references are stable across imports.
export const contracts = _contracts as unknown as Contract[];
export const tenants = _tenants as unknown as MyTenant[];

// M03 流程全矩阵（30 报告名称 × 7 环节 × 4 + 每报告 2 completed）由码表
// 加载期派生，与手写故事种子合并后对外导出（handlers 与消费方只见合并数组）。
import { buildFlowMatrix } from "./flow-matrix";
const flowMatrix = buildFlowMatrix({
  contracts,
  reportNames: _inspectionReportNames as unknown as InspectionReportName[],
  reportNameStandards: _inspectionReportNameStandards as unknown as ReportNameStandardLink[],
  reportNameParameters: _inspectionReportNameParameters as unknown as ReportNameParameterLink[],
  parameters: _inspectionParameters as unknown as InspectionParameter[],
});

export const sampleReceipts = [
  ..._sampleReceipts,
  ...flowMatrix.receipts,
] as unknown as SampleReceipt[];
export const samples = [..._samples, ...flowMatrix.samples] as unknown as Sample[];
export const testRecords = [
  ..._testRecords,
  ...flowMatrix.testRecords,
] as unknown as TestRecord[];
export const inspectionBrands = _inspectionBrands as unknown as CatalogEntry[];
export const inspectionModels = _inspectionModels as unknown as CatalogEntry[];
export const inspectionSpecs = _inspectionSpecs as unknown as CatalogEntry[];
export const inspectionGrades = _inspectionGrades as unknown as CatalogEntry[];
export const technicalRequirements = _technicalRequirements as unknown as TechnicalRequirement[];
export const inspectionSpecialties = _inspectionSpecialties as unknown as InspectionSpecialty[];
export const inspectionObjects = _inspectionObjects as unknown as InspectionObject[];
export const inspectionParameters = _inspectionParameters as unknown as InspectionParameter[];
export const inspectionStandards = _inspectionStandards as unknown as InspectionStandard[];
export const inspectionObjectParameters = _inspectionObjectParameters as unknown as ObjectParameterLink[];
export const inspectionObjectStandards = _inspectionObjectStandards as unknown as ObjectStandardLink[];
export const inspectionStandardParameters = _inspectionStandardParameters as unknown as StandardParameterLink[];
export const inspectionSpecialtyObjects = _inspectionSpecialtyObjects as unknown as SpecialtyObjectLink[];
export const inspectionCalculationMethods = _inspectionCalculationMethods as unknown as CalculationMethod[];
export const inspectionReportNames = _inspectionReportNames as unknown as InspectionReportName[];
export const inspectionObjectReportNames = _inspectionObjectReportNames as unknown as ObjectReportNameLink[];
export const inspectionReportNameStandards = _inspectionReportNameStandards as unknown as ReportNameStandardLink[];
export const inspectionReportNameParameters = _inspectionReportNameParameters as unknown as ReportNameParameterLink[];
export const inspectionParamInterfaces = _inspectionParamInterfaces as unknown as InspectionParamInterface[];
export const inspectionParamInterfaceLinks = _inspectionParamInterfaceLinks as unknown as ParamInterfaceLink[];

// === E2E reset（ADR-0033 阶段三，镜像 saas-msw 2026-09-11 先例）===
// msw 无持久化，但 handlers 对数组 push/splice——跨运行累积（如 E2E 每轮创建的
// 接样单/合同）会撑爆分页首屏，制造 flaky。启动时快照，POST /__e2e/reset 整体还原。
// 深克隆快照连带覆盖嵌套写（flowHistory.push 等）；splice 原位还原保引用稳定
// （makeCatalogOps 闭包持有的是数组实例本身）。
const E2E_SNAP = {
  contracts: structuredClone(contracts),
  tenants: structuredClone(tenants),
  sampleReceipts: structuredClone(sampleReceipts),
  samples: structuredClone(samples),
  testRecords: structuredClone(testRecords),
  inspectionBrands: structuredClone(inspectionBrands),
  inspectionModels: structuredClone(inspectionModels),
  inspectionSpecs: structuredClone(inspectionSpecs),
  inspectionGrades: structuredClone(inspectionGrades),
  technicalRequirements: structuredClone(technicalRequirements),
  inspectionSpecialties: structuredClone(inspectionSpecialties),
  inspectionObjects: structuredClone(inspectionObjects),
  inspectionParameters: structuredClone(inspectionParameters),
  inspectionStandards: structuredClone(inspectionStandards),
  inspectionObjectParameters: structuredClone(inspectionObjectParameters),
  inspectionObjectStandards: structuredClone(inspectionObjectStandards),
  inspectionStandardParameters: structuredClone(inspectionStandardParameters),
  inspectionSpecialtyObjects: structuredClone(inspectionSpecialtyObjects),
  inspectionCalculationMethods: structuredClone(inspectionCalculationMethods),
  inspectionReportNames: structuredClone(inspectionReportNames),
  inspectionObjectReportNames: structuredClone(inspectionObjectReportNames),
  inspectionReportNameStandards: structuredClone(inspectionReportNameStandards),
  inspectionReportNameParameters: structuredClone(inspectionReportNameParameters),
  inspectionParamInterfaces: structuredClone(inspectionParamInterfaces),
  inspectionParamInterfaceLinks: structuredClone(inspectionParamInterfaceLinks),
};

export function resetFixtures(): void {
  for (const [key, snap] of Object.entries(E2E_SNAP)) {
    // 消费方（nextjs/react）tsconfig 带 noUncheckedIndexedAccess，索引访问须先收窄。
    const table = (seedTables as Record<string, unknown[]>)[key];
    if (!table) {
      throw new Error(`resetFixtures: seedTables 缺 key "${key}"（与 E2E_SNAP 不同步）`);
    }
    table.splice(0, table.length, ...(snap as unknown[]));
  }
}

// splice 目标的稳定引用表（与 E2E_SNAP 同 key 集，指向导出的数组实例）
const seedTables: Record<string, unknown[]> = {
  contracts,
  tenants,
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
  inspectionObjectParameters,
  inspectionObjectStandards,
  inspectionStandardParameters,
  inspectionSpecialtyObjects,
  inspectionCalculationMethods,
  inspectionReportNames,
  inspectionObjectReportNames,
  inspectionReportNameStandards,
  inspectionReportNameParameters,
  inspectionParamInterfaces,
  inspectionParamInterfaceLinks,
};

// === Lookup helpers ===
export const getContract = (id: string) => contracts.find((c) => c.id === id);

export const getReceipt = (id: string) => sampleReceipts.find((r) => r.id === id);
export const listReceipts = () => sampleReceipts;

export const getSample = (id: string) => samples.find((s) => s.id === id);
export const listSamplesByReceipt = (receiptId: string) =>
  samples.filter((s) => s.receiptId === receiptId);

export const getTestRecord = (id: string) => testRecords.find((t) => t.id === id);
export const listTestRecordsBySample = (sampleId: string) =>
  testRecords.filter((t) => t.sampleId === sampleId);

// Generic catalog lookup factory (brand/model/spec/grade share shape)
function makeCatalogOps(arr: CatalogEntry[]) {
  return {
    list: (inspectionObjectCode?: string) =>
      inspectionObjectCode
        ? arr.filter((e) => e.inspectionObjectCode === inspectionObjectCode)
        : arr,
    get: (code: string) => arr.find((e) => e.code === code),
  };
}

export const brandOps = makeCatalogOps(inspectionBrands);
export const modelOps = makeCatalogOps(inspectionModels);
export const specOps = makeCatalogOps(inspectionSpecs);
export const gradeOps = makeCatalogOps(inspectionGrades);

// === M06 字典 lookups ===
export const getSpecialty = (code: string) => inspectionSpecialties.find((s) => s.code === code);
export const getObject = (code: string) => inspectionObjects.find((o) => o.code === code);
export const getParameter = (code: string) => inspectionParameters.find((p) => p.code === code);
export const getStandard = (code: string) => inspectionStandards.find((s) => s.code === code);
export const getReportName = (code: string) => inspectionReportNames.find((r) => r.code === code);
export const getInspectionParamInterface = (code: string) => inspectionParamInterfaces.find((p) => p.code === code);
export const getCalculationMethod = (objectCode: string, parameterCode: string) =>
  inspectionCalculationMethods.find(
    (r) => r.inspectionObjectCode === objectCode && r.inspectionParameterCode === parameterCode,
  );

export default {
  contracts,
  tenants,
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
  inspectionObjectParameters,
  inspectionObjectStandards,
  inspectionStandardParameters,
  inspectionSpecialtyObjects,
  inspectionCalculationMethods,
  inspectionReportNames,
  inspectionObjectReportNames,
  inspectionReportNameStandards,
  inspectionReportNameParameters,
  inspectionParamInterfaces,
  inspectionParamInterfaceLinks,
};
