// Seeds barrel — JSON-per-table format.
//   - src/seeds/{table}.json  (1 file per table)
//   - src/seeds/index.ts      (this barrel: named value exports)
//
// 9 tables: contracts / sample_receipts / samples / test_records (consumer-data,
// hand-authored since backup had none) + 5 M04 catalog/technical seeds copied
// from backup/lab-management-system-shared.
//
// Mutability: JSON imports are readonly at type level; fixtures/seed.ts casts
// to mutable arrays where handlers need to write.

import _CONTRACTS from "./contracts.json" with { type: "json" };
import _TENANTS from "./tenants.json" with { type: "json" };
import _SAMPLE_RECEIPTS from "./sample-receipts.json" with { type: "json" };
import _SAMPLES from "./samples.json" with { type: "json" };
import _TEST_RECORDS from "./test-records.json" with { type: "json" };
import _INSPECTION_BRANDS from "./inspection-brand.json" with { type: "json" };
import _INSPECTION_MODELS from "./inspection-model.json" with { type: "json" };
import _INSPECTION_SPECS from "./inspection-spec.json" with { type: "json" };
import _INSPECTION_GRADES from "./inspection-grade.json" with { type: "json" };
import _TECHNICAL_REQUIREMENTS from "./inspection-technical-requirement.json" with { type: "json" };
import _SPECIALTIES from "./inspection-specialty.json" with { type: "json" };
import _OBJECTS from "./inspection-object.json" with { type: "json" };
import _PARAMETERS from "./inspection-parameter.json" with { type: "json" };
import _STANDARDS from "./inspection-standard.json" with { type: "json" };
import _OBJECT_PARAMETERS from "./inspection-object-parameter.json" with { type: "json" };
import _OBJECT_STANDARDS from "./inspection-object-standard.json" with { type: "json" };
import _STANDARD_PARAMETERS from "./inspection-standard-parameter.json" with { type: "json" };
import _SPECIALTY_OBJECTS from "./inspection-specialty-object.json" with { type: "json" };
import _CALCULATION_METHODS from "./inspection-calculation-method.json" with { type: "json" };
import _REPORT_NAMES from "./inspection-report-name.json" with { type: "json" };
import _OBJECT_REPORT_NAMES from "./inspection-object-report-name.json" with { type: "json" };
import _REPORT_NAME_STANDARDS from "./inspection-report-name-standard.json" with { type: "json" };
import _REPORT_NAME_PARAMETERS from "./inspection-report-name-parameter.json" with { type: "json" };
import _INSPECTION_PARAM_INTERFACES from "./inspection-param-interface.json" with { type: "json" };
import _INSPECTION_PARAM_INTERFACE_LINKS from "./inspection-param-interface-link.json" with { type: "json" };

export const contracts = _CONTRACTS;
export const tenants = _TENANTS;
export const sampleReceipts = _SAMPLE_RECEIPTS;
export const samples = _SAMPLES;
export const testRecords = _TEST_RECORDS;
export const inspectionBrands = _INSPECTION_BRANDS;
export const inspectionModels = _INSPECTION_MODELS;
export const inspectionSpecs = _INSPECTION_SPECS;
export const inspectionGrades = _INSPECTION_GRADES;
export const technicalRequirements = _TECHNICAL_REQUIREMENTS;
export const inspectionSpecialties = _SPECIALTIES;
export const inspectionObjects = _OBJECTS;
export const inspectionParameters = _PARAMETERS;
export const inspectionStandards = _STANDARDS;
export const inspectionObjectParameters = _OBJECT_PARAMETERS;
export const inspectionObjectStandards = _OBJECT_STANDARDS;
export const inspectionStandardParameters = _STANDARD_PARAMETERS;
export const inspectionSpecialtyObjects = _SPECIALTY_OBJECTS;
export const inspectionCalculationMethods = _CALCULATION_METHODS;
export const inspectionReportNames = _REPORT_NAMES;
export const inspectionObjectReportNames = _OBJECT_REPORT_NAMES;
export const inspectionReportNameStandards = _REPORT_NAME_STANDARDS;
export const inspectionReportNameParameters = _REPORT_NAME_PARAMETERS;
export const inspectionParamInterfaces = _INSPECTION_PARAM_INTERFACES;
export const inspectionParamInterfaceLinks = _INSPECTION_PARAM_INTERFACE_LINKS;
