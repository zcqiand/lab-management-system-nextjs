// Type shim for shared DTOs. Lets msw 仓 avoid type-checking the entire
// orval-generated api-client. Keep in sync with @lab/management-system-shared
// openapi.yaml.

// === Common (M03 flow) ===
export type FlowStatus =
  | "receiving"
  | "task_assignment"
  | "data_entry"
  | "review"
  | "approval"
  | "issuance"
  | "archived"
  | "completed";

export type FlowAction = "submit" | "return" | "withdraw";

export interface FlowHistoryEntry {
  action: FlowAction;
  from: FlowStatus;
  to: FlowStatus;
  operator: string;
  at: string;
  reason?: string;
}

export interface FlowActionResult {
  id: string;
  ok: boolean;
  message?: string;
  flowStatus?: FlowStatus;
}

// === M01.F04/F05 — Auth ===
export interface CurrentUser {
  id: string;
  username: string;
  displayName?: string;
  roleCode?: string;
}

// 从 saas 身份平台下发的租户视图（lab 不拥有 tenants 表）
export interface MyTenant {
  tenantId: string;
  code: string;
  name: string;
  roleIds: string[];
}

// 当前会话：用户 + 关联租户 + 当前选中租户
export interface CurrentUserSession {
  user: CurrentUser;
  tenants: MyTenant[];
  currentTenantId?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: CurrentUser;
  tenants: MyTenant[];
}

export interface PermissionSet {
  permissions: string[];
}

export interface MenuNode {
  id: string;
  label: string;
  path?: string;
  icon?: string;
  children?: MenuNode[];
}

// === M02.F01 — Contract ===
export type ContractStatus = "active" | "archived";

export interface Contract {
  id: string;
  tenantId: string;
  contractCode: string;
  clientUnit: string;
  projectName: string;
  projectLocation?: string;
  constructionUnit: string;
  inspectionSpecialtyCode?: string;
  buildingUnit?: string;
  supervisorUnit?: string;
  inspectionPerson?: string;
  inspectionPhone?: string;
  witnessUnit: string;
  witness: string;
  witnessPhone?: string;
  contactPerson?: string;
  contactPhone?: string;
  entrustedDate?: string;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}

// === M03 — SampleReceipt / Sample / TestRecord ===
export type ReceiptResult = "pass" | "fail" | "";

export interface SampleReceipt {
  id: string;
  tenantId: string;
  contractId: string;
  commissionCode: string;
  commissionDate: string;
  commissionRegisterCode?: string;
  commissionRegisterDate?: string;
  categoryCode: string;
  projectName?: string;
  clientUnit?: string;
  buildingUnit?: string;
  supervisorUnit?: string;
  constructionUnit?: string;
  witnessUnit?: string;
  samplingLocation?: string;
  witness?: string;
  witnessPhone?: string;
  inspector?: string;
  inspectorPhone?: string;
  receivedBy: string;
  sampleSource: string;
  testCategory: string;
  testEnvironment?: string;
  mainEquipment?: string;
  testOperator?: string;
  testStartDate?: string;
  testEndDate?: string;
  originalRecordNo?: string;
  remark?: string;
  judgmentBasis?: string[];
  testingBasis?: string[];
  testParameters?: Record<string, unknown>;
  flowStatus: FlowStatus;
  flowHistory: FlowHistoryEntry[];
  lastSubmittedBy?: string;
  assigneeId?: string;
  assigneeName?: string;
  plannedTestDate?: string;
  reportCode?: string;
  reportDate?: string;
  conclusion?: string;
  result?: ReceiptResult;
  issuedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sample {
  id: string;
  tenantId: string;
  receiptId: string;
  sampleCode: string;
  sampleName?: string;
  model?: string;
  specification?: string;
  grade?: string;
  brand?: string;
  manufacturer?: string;
  structuralPart?: string;
  representQuantity?: string;
  sampleQuantity?: string;
  batchNumber?: string;
  supplyUnit?: string;
  arrivalDate?: string;
  samplingDate?: string;
  curingCondition?: string;
  age?: string;
  ext: Record<string, string>;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestRecord {
  id: string;
  tenantId: string;
  sampleId: string;
  parameterCode: string;
  standardCode?: string;
  requirementCode?: string;
  requirement: string;
  result: string;
  verdict?: string;
  createdAt: string;
  updatedAt: string;
}

// === M04.F06-F09 — Catalog code tables (homomorphic) ===
export interface CatalogEntry {
  code: string;
  tenantId: string;
  inspectionObjectCode?: string;
  name: string;
  remark?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// === M04.F05 — TechnicalRequirement ===
export type RequirementValueType = "numeric" | "string" | "range" | "formula" | "manual";
export type RequirementComparison = "≥" | "≤" | "=" | "range" | "eq";
export type RequirementVerificationStatus = "draft" | "reviewed" | "verified" | "rejected";
export type RequirementJudgmentMode = "automatic" | "manual";

export interface TechnicalRequirement {
  tenantId: string;
  inspectionObjectCode: string;
  inspectionParameterCode: string;
  judgmentStandardCode: string;
  conditions?: string;
  valueType: RequirementValueType;
  minValue?: number;
  maxValue?: number;
  targetValue?: string;
  expression?: string;
  unit?: string;
  comparison: RequirementComparison;
  judgmentMode: RequirementJudgmentMode;
  verificationStatus: RequirementVerificationStatus;
  clause?: string;
  sourcePage?: number;
  sourceHash?: string;
  brand?: string;
  model?: string;
  grade?: string;
  spec?: string;
  sieve?: string;
  remark?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// === M05.F01 — Summary ===
export interface SummaryColumn {
  key: string;
  label: string;
}

export interface SummaryData {
  summaryName: string;
  columns: SummaryColumn[];
  rows: Record<string, string>[];
}

// === M06 检测能力字典 ===
export type InspectionStandardStatus = "active" | "superseded" | "draft";
export type InspectionParameterSourceType = "official" | "custom";
export type QualificationLevel = "QUALIFIED" | "RESTRICTED";
export type InspectionStandardRole = "TESTING" | "JUDGMENT";

export interface InspectionSpecialty {
  code: string;
  officialNo: string;
  name: string;
  isOfficial: boolean;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionObject {
  code: string;
  inspectionSpecialtyCode: string;
  sourceProjectNo: string;
  sourceProjectName: string;
  name: string;
  isOptionalForQualification: boolean;
  isOfficial: boolean;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionParameter {
  code: string;
  name: string;
  rawName: string;
  canonicalName: string;
  methodText?: string;
  aliases: string[];
  unit?: string;
  sourceType: InspectionParameterSourceType;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionStandard {
  code: string;
  name: string;
  version?: string;
  status: InspectionStandardStatus;
  sourceDocumentId?: string;
  sourceHash?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CalculationAlgorithmType =
  | "simple_avg"
  | "compressive_strength"
  | "flexural_strength"
  | "steel_tensile"
  | "formula"
  | "manual"
  | "auto_calc_ratio";

export interface CalculationMethod {
  inspectionObjectCode: string;
  inspectionParameterCode: string;
  testingStandardCode?: string;
  reportNameCode?: string;
  algorithmType: CalculationAlgorithmType;
  specimenCount: number;
  formula?: string;
  conditions?: string;
  roundingRule?: string;
  remark?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExtFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  required?: boolean;
  options?: string[];
  tag?: string;
  source?: "sample" | "receipt";
}

export interface InspectionReportName {
  code: string;
  name: string;
  fullName?: string;
  templatePath?: string;
  summaryName?: string;
  extFields?: ExtFieldDef[];
  description?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionParamInterface {
  code: string;
  name?: string;
  componentPath: string;
  description?: string;
  isOfficial?: boolean;
  sortOrder: number;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// junction rows (typed loosely — composite-key records)
export interface SpecialtyObjectLink {
  inspectionSpecialtyCode: string;
  inspectionObjectCode: string;
  remark?: string;
}
export interface ObjectParameterLink {
  inspectionObjectCode: string;
  inspectionParameterCode: string;
  qualificationLevel: QualificationLevel;
  sourcePage?: number;
  remark?: string;
}
export interface ObjectStandardLink {
  inspectionObjectCode: string;
  inspectionStandardCode: string;
  role: InspectionStandardRole;
  remark?: string;
}
export interface StandardParameterLink {
  inspectionStandardCode: string;
  inspectionParameterCode: string;
}
export interface ObjectReportNameLink {
  inspectionObjectCode: string;
  reportNameCode: string;
  remark?: string;
}
export interface ReportNameStandardLink {
  reportNameCode: string;
  inspectionStandardCode: string;
  role: InspectionStandardRole;
  remark?: string;
}
export interface ReportNameParameterLink {
  reportNameCode: string;
  inspectionParameterCode: string;
  remark?: string;
}
export interface ParamInterfaceLink {
  inspectionParameterCode: string;
  paramInterfaceCode: string;
  reportNameCode?: string;
  config?: Record<string, unknown>;
}
