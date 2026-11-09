import {
  pgTable,
  check,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  foreignKey,
  uniqueIndex,
  serial,
  bigint,
  primaryKey,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const inspectionParamInterfaces = pgTable(
  "inspection_param_interfaces",
  {
    code: text().primaryKey().notNull(),
    name: text(),
    componentPath: text("component_path").notNull(),
    description: text(),
    isOfficial: boolean("is_official"),
    sortOrder: integer("sort_order").default(0).notNull(),
    config: jsonb(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  () => {
    return {
      inspectionParamInterfacesCreatedAtNotNull: check(
        "inspection_param_interfaces_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionParamInterfacesCodeNotNull: check(
        "inspection_param_interfaces_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionParamInterfacesComponentPathNotNull: check(
        "inspection_param_interfaces_component_path_not_null",
        sql`NOT NULL component_path`,
      ),
      inspectionParamInterfacesSortOrderNotNull: check(
        "inspection_param_interfaces_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionParamInterfacesUpdatedAtNotNull: check(
        "inspection_param_interfaces_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionSpecs = pgTable(
  "inspection_specs",
  {
    code: text().primaryKey().notNull(),
    inspectionObjectCode: text("inspection_object_code"),
    name: text().notNull(),
    remark: text(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxInspectionSpecsObject: index("idx_inspection_specs_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      specsObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "specs_object_fk",
      }).onDelete("set null"),
      inspectionSpecsCodeNotNull: check(
        "inspection_specs_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionSpecsNameNotNull: check(
        "inspection_specs_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionSpecsSortOrderNotNull: check(
        "inspection_specs_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionSpecsCreatedAtNotNull: check(
        "inspection_specs_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionSpecsUpdatedAtNotNull: check(
        "inspection_specs_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const sampleReceipts = pgTable(
  "sample_receipts",
  {
    id: text().primaryKey().notNull(),
    contractId: text("contract_id").notNull(),
    commissionCode: text("commission_code").notNull(),
    commissionDate: text("commission_date").notNull(),
    commissionRegisterCode: text("commission_register_code"),
    commissionRegisterDate: text("commission_register_date"),
    categoryCode: text("category_code").notNull(),
    projectName: text("project_name"),
    clientUnit: text("client_unit"),
    buildingUnit: text("building_unit"),
    supervisorUnit: text("supervisor_unit"),
    constructionUnit: text("construction_unit"),
    witnessUnit: text("witness_unit"),
    samplingLocation: text("sampling_location"),
    witness: text(),
    witnessPhone: text("witness_phone"),
    inspector: text(),
    inspectorPhone: text("inspector_phone"),
    receivedBy: text("received_by").notNull(),
    sampleSource: text("sample_source").notNull(),
    testCategory: text("test_category").notNull(),
    testEnvironment: text("test_environment"),
    mainEquipment: text("main_equipment"),
    testOperator: text("test_operator"),
    testStartDate: text("test_start_date"),
    testEndDate: text("test_end_date"),
    originalRecordNo: text("original_record_no"),
    remark: text(),
    judgmentBasis: jsonb("judgment_basis"),
    testingBasis: jsonb("testing_basis"),
    testParameters: jsonb("test_parameters"),
    ext: jsonb().default({}).notNull(),
    flowStatus: text("flow_status").default("receiving").notNull(),
    flowHistory: jsonb("flow_history").default([]).notNull(),
    lastSubmittedBy: text("last_submitted_by"),
    assigneeId: text("assignee_id"),
    assigneeName: text("assignee_name"),
    plannedTestDate: text("planned_test_date"),
    reportCode: text("report_code"),
    reportDate: text("report_date"),
    conclusion: text(),
    result: text(),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    tenantId: text("tenant_id").notNull(),
  },
  (table) => {
    return {
      idxReceiptsTenant: index("idx_receipts_tenant").using(
        "btree",
        table.tenantId.asc().nullsLast().op("text_ops"),
      ),
      idxReceiptsTenantCommission: uniqueIndex("idx_receipts_tenant_commission").using(
        "btree",
        table.tenantId.asc().nullsLast().op("text_ops"),
        table.commissionCode.asc().nullsLast().op("text_ops"),
      ),
      idxSampleReceiptsCategory: index("idx_sample_receipts_category").using(
        "btree",
        table.categoryCode.asc().nullsLast().op("text_ops"),
      ),
      idxSampleReceiptsContract: index("idx_sample_receipts_contract").using(
        "btree",
        table.contractId.asc().nullsLast().op("text_ops"),
      ),
      idxSampleReceiptsFlowStatus: index("idx_sample_receipts_flow_status").using(
        "btree",
        table.flowStatus.asc().nullsLast().op("text_ops"),
      ),
      sampleReceiptsContractFk: foreignKey({
        columns: [table.contractId],
        foreignColumns: [contracts.id],
        name: "sample_receipts_contract_fk",
      }).onDelete("restrict"),
      receiptsCategoryFk: foreignKey({
        columns: [table.categoryCode],
        foreignColumns: [inspectionReportNames.code],
        name: "receipts_category_fk",
      }).onDelete("restrict"),
      sampleReceiptsCreatedAtNotNull: check(
        "sample_receipts_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      sampleReceiptsUpdatedAtNotNull: check(
        "sample_receipts_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
      sampleReceiptsTenantIdNotNull: check(
        "sample_receipts_tenant_id_not_null",
        sql`NOT NULL tenant_id`,
      ),
      ckReceiptsFlowStatus: check(
        "ck_receipts_flow_status",
        sql`flow_status = ANY (ARRAY['receiving'::text, 'task_assignment'::text, 'data_entry'::text, 'review'::text, 'approval'::text, 'issuance'::text, 'archived'::text, 'completed'::text])`,
      ),
      sampleReceiptsIdNotNull: check("sample_receipts_id_not_null", sql`NOT NULL id`),
      sampleReceiptsContractIdNotNull: check(
        "sample_receipts_contract_id_not_null",
        sql`NOT NULL contract_id`,
      ),
      sampleReceiptsCommissionCodeNotNull: check(
        "sample_receipts_commission_code_not_null",
        sql`NOT NULL commission_code`,
      ),
      sampleReceiptsCommissionDateNotNull: check(
        "sample_receipts_commission_date_not_null",
        sql`NOT NULL commission_date`,
      ),
      sampleReceiptsCategoryCodeNotNull: check(
        "sample_receipts_category_code_not_null",
        sql`NOT NULL category_code`,
      ),
      sampleReceiptsReceivedByNotNull: check(
        "sample_receipts_received_by_not_null",
        sql`NOT NULL received_by`,
      ),
      sampleReceiptsSampleSourceNotNull: check(
        "sample_receipts_sample_source_not_null",
        sql`NOT NULL sample_source`,
      ),
      sampleReceiptsTestCategoryNotNull: check(
        "sample_receipts_test_category_not_null",
        sql`NOT NULL test_category`,
      ),
      sampleReceiptsExtNotNull: check("sample_receipts_ext_not_null", sql`NOT NULL ext`),
      sampleReceiptsFlowStatusNotNull: check(
        "sample_receipts_flow_status_not_null",
        sql`NOT NULL flow_status`,
      ),
      sampleReceiptsFlowHistoryNotNull: check(
        "sample_receipts_flow_history_not_null",
        sql`NOT NULL flow_history`,
      ),
    };
  },
);

export const samples = pgTable(
  "samples",
  {
    id: text().primaryKey().notNull(),
    receiptId: text("receipt_id").notNull(),
    sampleCode: text("sample_code").notNull(),
    sampleName: text("sample_name"),
    model: text(),
    specification: text(),
    grade: text(),
    brand: text(),
    manufacturer: text(),
    structuralPart: text("structural_part"),
    representQuantity: text("represent_quantity"),
    sampleQuantity: text("sample_quantity"),
    batchNumber: text("batch_number"),
    supplyUnit: text("supply_unit"),
    arrivalDate: text("arrival_date"),
    samplingDate: text("sampling_date"),
    curingCondition: text("curing_condition"),
    age: text(),
    ext: jsonb().default({}).notNull(),
    remark: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    tenantId: text("tenant_id").notNull(),
  },
  (table) => {
    return {
      idxSamplesReceipt: index("idx_samples_receipt").using(
        "btree",
        table.receiptId.asc().nullsLast().op("text_ops"),
      ),
      idxSamplesTenantCode: uniqueIndex("idx_samples_tenant_code").using(
        "btree",
        table.tenantId.asc().nullsLast().op("text_ops"),
        table.sampleCode.asc().nullsLast().op("text_ops"),
      ),
      samplesReceiptFk: foreignKey({
        columns: [table.receiptId],
        foreignColumns: [sampleReceipts.id],
        name: "samples_receipt_fk",
      }).onDelete("cascade"),
      samplesModelFk: foreignKey({
        columns: [table.model],
        foreignColumns: [inspectionModels.code],
        name: "samples_model_fk",
      }).onDelete("set null"),
      samplesSpecFk: foreignKey({
        columns: [table.specification],
        foreignColumns: [inspectionSpecs.code],
        name: "samples_spec_fk",
      }).onDelete("set null"),
      samplesGradeFk: foreignKey({
        columns: [table.grade],
        foreignColumns: [inspectionGrades.code],
        name: "samples_grade_fk",
      }).onDelete("set null"),
      samplesBrandFk: foreignKey({
        columns: [table.brand],
        foreignColumns: [inspectionBrands.code],
        name: "samples_brand_fk",
      }).onDelete("set null"),
      samplesIdNotNull: check("samples_id_not_null", sql`NOT NULL id`),
      samplesReceiptIdNotNull: check(
        "samples_receipt_id_not_null",
        sql`NOT NULL receipt_id`,
      ),
      samplesSampleCodeNotNull: check(
        "samples_sample_code_not_null",
        sql`NOT NULL sample_code`,
      ),
      samplesExtNotNull: check("samples_ext_not_null", sql`NOT NULL ext`),
      samplesCreatedAtNotNull: check(
        "samples_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      samplesUpdatedAtNotNull: check(
        "samples_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
      samplesTenantIdNotNull: check(
        "samples_tenant_id_not_null",
        sql`NOT NULL tenant_id`,
      ),
    };
  },
);

export const testRecords = pgTable(
  "test_records",
  {
    id: text().primaryKey().notNull(),
    sampleId: text("sample_id").notNull(),
    parameterCode: text("parameter_code").notNull(),
    standardCode: text("standard_code"),
    requirementCode: text("requirement_code"),
    requirement: text().notNull(),
    result: text().notNull(),
    verdict: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    tenantId: text("tenant_id").notNull(),
  },
  (table) => {
    return {
      idxTestRecordsSample: index("idx_test_records_sample").using(
        "btree",
        table.sampleId.asc().nullsLast().op("text_ops"),
      ),
      idxTestRecordsTenant: index("idx_test_records_tenant").using(
        "btree",
        table.tenantId.asc().nullsLast().op("text_ops"),
      ),
      testRecordsSampleFk: foreignKey({
        columns: [table.sampleId],
        foreignColumns: [samples.id],
        name: "test_records_sample_fk",
      }).onDelete("cascade"),
      testrecParamFk: foreignKey({
        columns: [table.parameterCode],
        foreignColumns: [inspectionParameters.code],
        name: "testrec_param_fk",
      }).onDelete("restrict"),
      testrecStandardFk: foreignKey({
        columns: [table.standardCode],
        foreignColumns: [inspectionStandards.code],
        name: "testrec_standard_fk",
      }).onDelete("set null"),
      testRecordsIdNotNull: check("test_records_id_not_null", sql`NOT NULL id`),
      testRecordsSampleIdNotNull: check(
        "test_records_sample_id_not_null",
        sql`NOT NULL sample_id`,
      ),
      testRecordsParameterCodeNotNull: check(
        "test_records_parameter_code_not_null",
        sql`NOT NULL parameter_code`,
      ),
      testRecordsRequirementNotNull: check(
        "test_records_requirement_not_null",
        sql`NOT NULL requirement`,
      ),
      testRecordsResultNotNull: check(
        "test_records_result_not_null",
        sql`NOT NULL result`,
      ),
      testRecordsCreatedAtNotNull: check(
        "test_records_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      testRecordsUpdatedAtNotNull: check(
        "test_records_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
      testRecordsTenantIdNotNull: check(
        "test_records_tenant_id_not_null",
        sql`NOT NULL tenant_id`,
      ),
    };
  },
);

export const inspectionSpecialties = pgTable(
  "inspection_specialties",
  {
    code: text().primaryKey().notNull(),
    officialNo: text("official_no").notNull(),
    name: text().notNull(),
    isOfficial: boolean("is_official").default(true).notNull(),
    enabled: boolean().default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  () => {
    return {
      inspectionSpecialtiesCodeNotNull: check(
        "inspection_specialties_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionSpecialtiesOfficialNoNotNull: check(
        "inspection_specialties_official_no_not_null",
        sql`NOT NULL official_no`,
      ),
      inspectionSpecialtiesNameNotNull: check(
        "inspection_specialties_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionSpecialtiesIsOfficialNotNull: check(
        "inspection_specialties_is_official_not_null",
        sql`NOT NULL is_official`,
      ),
      inspectionSpecialtiesEnabledNotNull: check(
        "inspection_specialties_enabled_not_null",
        sql`NOT NULL enabled`,
      ),
      inspectionSpecialtiesSortOrderNotNull: check(
        "inspection_specialties_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionSpecialtiesCreatedAtNotNull: check(
        "inspection_specialties_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionSpecialtiesUpdatedAtNotNull: check(
        "inspection_specialties_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const contracts = pgTable(
  "contracts",
  {
    id: text().primaryKey().notNull(),
    contractCode: text("contract_code").notNull(),
    clientUnit: text("client_unit").notNull(),
    projectName: text("project_name").notNull(),
    projectLocation: text("project_location"),
    constructionUnit: text("construction_unit").notNull(),
    inspectionSpecialtyCode: text("inspection_specialty_code"),
    buildingUnit: text("building_unit"),
    supervisorUnit: text("supervisor_unit"),
    inspectionPerson: text("inspection_person"),
    inspectionPhone: text("inspection_phone"),
    witnessUnit: text("witness_unit").notNull(),
    witness: text().notNull(),
    witnessPhone: text("witness_phone"),
    contactPerson: text("contact_person"),
    contactPhone: text("contact_phone"),
    entrustedDate: text("entrusted_date"),
    status: text().default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    tenantId: text("tenant_id").notNull(),
  },
  (table) => {
    return {
      idxContractsTenant: index("idx_contracts_tenant").using(
        "btree",
        table.tenantId.asc().nullsLast().op("text_ops"),
      ),
      idxContractsTenantCode: uniqueIndex("idx_contracts_tenant_code").using(
        "btree",
        table.tenantId.asc().nullsLast().op("text_ops"),
        table.contractCode.asc().nullsLast().op("text_ops"),
      ),
      contractsSpecialtyFk: foreignKey({
        columns: [table.inspectionSpecialtyCode],
        foreignColumns: [inspectionSpecialties.code],
        name: "contracts_specialty_fk",
      }).onDelete("set null"),
      ckContractsStatus: check(
        "ck_contracts_status",
        sql`status = ANY (ARRAY['active'::text, 'archived'::text])`,
      ),
      contractsIdNotNull: check("contracts_id_not_null", sql`NOT NULL id`),
      contractsContractCodeNotNull: check(
        "contracts_contract_code_not_null",
        sql`NOT NULL contract_code`,
      ),
      contractsClientUnitNotNull: check(
        "contracts_client_unit_not_null",
        sql`NOT NULL client_unit`,
      ),
      contractsProjectNameNotNull: check(
        "contracts_project_name_not_null",
        sql`NOT NULL project_name`,
      ),
      contractsConstructionUnitNotNull: check(
        "contracts_construction_unit_not_null",
        sql`NOT NULL construction_unit`,
      ),
      contractsWitnessUnitNotNull: check(
        "contracts_witness_unit_not_null",
        sql`NOT NULL witness_unit`,
      ),
      contractsWitnessNotNull: check("contracts_witness_not_null", sql`NOT NULL witness`),
      contractsStatusNotNull: check("contracts_status_not_null", sql`NOT NULL status`),
      contractsCreatedAtNotNull: check(
        "contracts_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      contractsUpdatedAtNotNull: check(
        "contracts_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
      contractsTenantIdNotNull: check(
        "contracts_tenant_id_not_null",
        sql`NOT NULL tenant_id`,
      ),
    };
  },
);

export const inspectionObjects = pgTable(
  "inspection_objects",
  {
    code: text().primaryKey().notNull(),
    sourceProjectNo: text("source_project_no").notNull(),
    sourceProjectName: text("source_project_name").notNull(),
    name: text().notNull(),
    isOptionalForQualification: boolean("is_optional_for_qualification")
      .default(false)
      .notNull(),
    isOfficial: boolean("is_official").default(true).notNull(),
    enabled: boolean().default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  () => {
    return {
      inspectionObjectsCodeNotNull: check(
        "inspection_objects_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionObjectsSourceProjectNoNotNull: check(
        "inspection_objects_source_project_no_not_null",
        sql`NOT NULL source_project_no`,
      ),
      inspectionObjectsSourceProjectNameNotNull: check(
        "inspection_objects_source_project_name_not_null",
        sql`NOT NULL source_project_name`,
      ),
      inspectionObjectsNameNotNull: check(
        "inspection_objects_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionObjectsIsOptionalForQualificationNotNull: check(
        "inspection_objects_is_optional_for_qualification_not_null",
        sql`NOT NULL is_optional_for_qualification`,
      ),
      inspectionObjectsIsOfficialNotNull: check(
        "inspection_objects_is_official_not_null",
        sql`NOT NULL is_official`,
      ),
      inspectionObjectsEnabledNotNull: check(
        "inspection_objects_enabled_not_null",
        sql`NOT NULL enabled`,
      ),
      inspectionObjectsSortOrderNotNull: check(
        "inspection_objects_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionObjectsCreatedAtNotNull: check(
        "inspection_objects_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionObjectsUpdatedAtNotNull: check(
        "inspection_objects_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionBrands = pgTable(
  "inspection_brands",
  {
    code: text().primaryKey().notNull(),
    inspectionObjectCode: text("inspection_object_code"),
    name: text().notNull(),
    remark: text(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxInspectionBrandsObject: index("idx_inspection_brands_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      brandsObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "brands_object_fk",
      }).onDelete("set null"),
      inspectionBrandsCodeNotNull: check(
        "inspection_brands_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionBrandsNameNotNull: check(
        "inspection_brands_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionBrandsSortOrderNotNull: check(
        "inspection_brands_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionBrandsCreatedAtNotNull: check(
        "inspection_brands_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionBrandsUpdatedAtNotNull: check(
        "inspection_brands_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionParameters = pgTable(
  "inspection_parameters",
  {
    code: text().primaryKey().notNull(),
    name: text().notNull(),
    rawName: text("raw_name").notNull(),
    canonicalName: text("canonical_name").notNull(),
    methodText: text("method_text"),
    aliases: jsonb().default([]).notNull(),
    unit: text(),
    sourceType: text("source_type").default("official").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  () => {
    return {
      ckParamsSourceType: check(
        "ck_params_source_type",
        sql`source_type = ANY (ARRAY['official'::text, 'custom'::text])`,
      ),
      inspectionParametersCodeNotNull: check(
        "inspection_parameters_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionParametersNameNotNull: check(
        "inspection_parameters_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionParametersRawNameNotNull: check(
        "inspection_parameters_raw_name_not_null",
        sql`NOT NULL raw_name`,
      ),
      inspectionParametersCanonicalNameNotNull: check(
        "inspection_parameters_canonical_name_not_null",
        sql`NOT NULL canonical_name`,
      ),
      inspectionParametersAliasesNotNull: check(
        "inspection_parameters_aliases_not_null",
        sql`NOT NULL aliases`,
      ),
      inspectionParametersSourceTypeNotNull: check(
        "inspection_parameters_source_type_not_null",
        sql`NOT NULL source_type`,
      ),
      inspectionParametersSortOrderNotNull: check(
        "inspection_parameters_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionParametersCreatedAtNotNull: check(
        "inspection_parameters_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionParametersUpdatedAtNotNull: check(
        "inspection_parameters_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionStandards = pgTable(
  "inspection_standards",
  {
    code: text().primaryKey().notNull(),
    name: text().notNull(),
    version: text(),
    status: text().default("active").notNull(),
    sourceDocumentId: text("source_document_id"),
    sourceHash: text("source_hash"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  () => {
    return {
      ckStandardsStatus: check(
        "ck_standards_status",
        sql`status = ANY (ARRAY['active'::text, 'superseded'::text, 'draft'::text])`,
      ),
      inspectionStandardsCodeNotNull: check(
        "inspection_standards_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionStandardsNameNotNull: check(
        "inspection_standards_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionStandardsStatusNotNull: check(
        "inspection_standards_status_not_null",
        sql`NOT NULL status`,
      ),
      inspectionStandardsSortOrderNotNull: check(
        "inspection_standards_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionStandardsCreatedAtNotNull: check(
        "inspection_standards_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionStandardsUpdatedAtNotNull: check(
        "inspection_standards_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionReportNames = pgTable(
  "inspection_report_names",
  {
    code: text().primaryKey().notNull(),
    name: text().notNull(),
    fullName: text("full_name"),
    templatePath: text("template_path"),
    summaryName: text("summary_name"),
    extFields: jsonb("ext_fields"),
    description: text(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  () => {
    return {
      inspectionReportNamesCodeNotNull: check(
        "inspection_report_names_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionReportNamesNameNotNull: check(
        "inspection_report_names_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionReportNamesSortOrderNotNull: check(
        "inspection_report_names_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionReportNamesCreatedAtNotNull: check(
        "inspection_report_names_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionReportNamesUpdatedAtNotNull: check(
        "inspection_report_names_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionGrades = pgTable(
  "inspection_grades",
  {
    code: text().primaryKey().notNull(),
    inspectionObjectCode: text("inspection_object_code"),
    name: text().notNull(),
    remark: text(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxInspectionGradesObject: index("idx_inspection_grades_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      gradesObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "grades_object_fk",
      }).onDelete("set null"),
      inspectionGradesCodeNotNull: check(
        "inspection_grades_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionGradesNameNotNull: check(
        "inspection_grades_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionGradesSortOrderNotNull: check(
        "inspection_grades_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionGradesCreatedAtNotNull: check(
        "inspection_grades_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionGradesUpdatedAtNotNull: check(
        "inspection_grades_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionModels = pgTable(
  "inspection_models",
  {
    code: text().primaryKey().notNull(),
    inspectionObjectCode: text("inspection_object_code"),
    name: text().notNull(),
    remark: text(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxInspectionModelsObject: index("idx_inspection_models_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      modelsObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "models_object_fk",
      }).onDelete("set null"),
      inspectionModelsCodeNotNull: check(
        "inspection_models_code_not_null",
        sql`NOT NULL code`,
      ),
      inspectionModelsNameNotNull: check(
        "inspection_models_name_not_null",
        sql`NOT NULL name`,
      ),
      inspectionModelsSortOrderNotNull: check(
        "inspection_models_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionModelsCreatedAtNotNull: check(
        "inspection_models_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionModelsUpdatedAtNotNull: check(
        "inspection_models_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const drizzleMigrations = pgTable(
  "__drizzle_migrations",
  {
    id: serial().primaryKey().notNull(),
    hash: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    createdAt: bigint("created_at", { mode: "number" }),
  },
  () => {
    return {
      drizzleMigrationsIdNotNull: check(
        "__drizzle_migrations_id_not_null",
        sql`NOT NULL id`,
      ),
      drizzleMigrationsHashNotNull: check(
        "__drizzle_migrations_hash_not_null",
        sql`NOT NULL hash`,
      ),
    };
  },
);

export const inspectionStandardParameters = pgTable(
  "inspection_standard_parameters",
  {
    inspectionStandardCode: text("inspection_standard_code").notNull(),
    inspectionParameterCode: text("inspection_parameter_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxStdParamStandard: index("idx_std_param_standard").using(
        "btree",
        table.inspectionStandardCode.asc().nullsLast().op("text_ops"),
      ),
      stdParamStandardFk: foreignKey({
        columns: [table.inspectionStandardCode],
        foreignColumns: [inspectionStandards.code],
        name: "std_param_standard_fk",
      }).onDelete("cascade"),
      stdParamParameterFk: foreignKey({
        columns: [table.inspectionParameterCode],
        foreignColumns: [inspectionParameters.code],
        name: "std_param_parameter_fk",
      }).onDelete("cascade"),
      inspectionStandardParametersPkey: primaryKey({
        columns: [table.inspectionParameterCode, table.inspectionStandardCode],
        name: "inspection_standard_parameters_pkey",
      }),
      inspectionStandardParameterInspectionStandardCodeNotNull: check(
        "inspection_standard_parameter_inspection_standard_code_not_null",
        sql`NOT NULL inspection_standard_code`,
      ),
      inspectionStandardParameteInspectionParameterCodeNotNull: check(
        "inspection_standard_paramete_inspection_parameter_code_not_null",
        sql`NOT NULL inspection_parameter_code`,
      ),
      inspectionStandardParametersCreatedAtNotNull: check(
        "inspection_standard_parameters_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionStandardParametersUpdatedAtNotNull: check(
        "inspection_standard_parameters_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionObjectReportNames = pgTable(
  "inspection_object_report_names",
  {
    inspectionObjectCode: text("inspection_object_code").notNull(),
    reportNameCode: text("report_name_code").notNull(),
    remark: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxObjRnObject: index("idx_obj_rn_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      objRnObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "obj_rn_object_fk",
      }).onDelete("cascade"),
      objRnReportFk: foreignKey({
        columns: [table.reportNameCode],
        foreignColumns: [inspectionReportNames.code],
        name: "obj_rn_report_fk",
      }).onDelete("cascade"),
      inspectionObjectReportNamesPkey: primaryKey({
        columns: [table.inspectionObjectCode, table.reportNameCode],
        name: "inspection_object_report_names_pkey",
      }),
      inspectionObjectReportNamesInspectionObjectCodeNotNull: check(
        "inspection_object_report_names_inspection_object_code_not_null",
        sql`NOT NULL inspection_object_code`,
      ),
      inspectionObjectReportNamesReportNameCodeNotNull: check(
        "inspection_object_report_names_report_name_code_not_null",
        sql`NOT NULL report_name_code`,
      ),
      inspectionObjectReportNamesCreatedAtNotNull: check(
        "inspection_object_report_names_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionObjectReportNamesUpdatedAtNotNull: check(
        "inspection_object_report_names_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionReportNameParameters = pgTable(
  "inspection_report_name_parameters",
  {
    reportNameCode: text("report_name_code").notNull(),
    inspectionParameterCode: text("inspection_parameter_code").notNull(),
    remark: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxRnParamReport: index("idx_rn_param_report").using(
        "btree",
        table.reportNameCode.asc().nullsLast().op("text_ops"),
      ),
      rnParamReportFk: foreignKey({
        columns: [table.reportNameCode],
        foreignColumns: [inspectionReportNames.code],
        name: "rn_param_report_fk",
      }).onDelete("cascade"),
      rnParamParameterFk: foreignKey({
        columns: [table.inspectionParameterCode],
        foreignColumns: [inspectionParameters.code],
        name: "rn_param_parameter_fk",
      }).onDelete("cascade"),
      inspectionReportNameParametersPkey: primaryKey({
        columns: [table.inspectionParameterCode, table.reportNameCode],
        name: "inspection_report_name_parameters_pkey",
      }),
      inspectionReportNameParametersReportNameCodeNotNull: check(
        "inspection_report_name_parameters_report_name_code_not_null",
        sql`NOT NULL report_name_code`,
      ),
      inspectionReportNameParamInspectionParameterCodeNotNull: check(
        "inspection_report_name_param_inspection_parameter_code_not_null",
        sql`NOT NULL inspection_parameter_code`,
      ),
      inspectionReportNameParametersCreatedAtNotNull: check(
        "inspection_report_name_parameters_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionReportNameParametersUpdatedAtNotNull: check(
        "inspection_report_name_parameters_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionSpecialtyObjects = pgTable(
  "inspection_specialty_objects",
  {
    inspectionSpecialtyCode: text("inspection_specialty_code").notNull(),
    inspectionObjectCode: text("inspection_object_code").notNull(),
    remark: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      specialtyObjectsSpecialtyFk: foreignKey({
        columns: [table.inspectionSpecialtyCode],
        foreignColumns: [inspectionSpecialties.code],
        name: "specialty_objects_specialty_fk",
      }).onDelete("cascade"),
      specialtyObjectsObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "specialty_objects_object_fk",
      }).onDelete("cascade"),
      inspectionSpecialtyObjectsPkey: primaryKey({
        columns: [table.inspectionObjectCode, table.inspectionSpecialtyCode],
        name: "inspection_specialty_objects_pkey",
      }),
      inspectionSpecialtyObjectsInspectionSpecialtyCodeNotNull: check(
        "inspection_specialty_objects_inspection_specialty_code_not_null",
        sql`NOT NULL inspection_specialty_code`,
      ),
      inspectionSpecialtyObjectsInspectionObjectCodeNotNull: check(
        "inspection_specialty_objects_inspection_object_code_not_null",
        sql`NOT NULL inspection_object_code`,
      ),
      inspectionSpecialtyObjectsCreatedAtNotNull: check(
        "inspection_specialty_objects_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionSpecialtyObjectsUpdatedAtNotNull: check(
        "inspection_specialty_objects_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionObjectStandards = pgTable(
  "inspection_object_standards",
  {
    inspectionObjectCode: text("inspection_object_code").notNull(),
    inspectionStandardCode: text("inspection_standard_code").notNull(),
    role: text().notNull(),
    remark: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxObjStdObject: index("idx_obj_std_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      objStdObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "obj_std_object_fk",
      }).onDelete("cascade"),
      objStdStandardFk: foreignKey({
        columns: [table.inspectionStandardCode],
        foreignColumns: [inspectionStandards.code],
        name: "obj_std_standard_fk",
      }).onDelete("cascade"),
      inspectionObjectStandardsPkey: primaryKey({
        columns: [table.inspectionObjectCode, table.inspectionStandardCode, table.role],
        name: "inspection_object_standards_pkey",
      }),
      ckObjStdRole: check(
        "ck_obj_std_role",
        sql`role = ANY (ARRAY['TESTING'::text, 'JUDGMENT'::text])`,
      ),
      inspectionObjectStandardsInspectionObjectCodeNotNull: check(
        "inspection_object_standards_inspection_object_code_not_null",
        sql`NOT NULL inspection_object_code`,
      ),
      inspectionObjectStandardsInspectionStandardCodeNotNull: check(
        "inspection_object_standards_inspection_standard_code_not_null",
        sql`NOT NULL inspection_standard_code`,
      ),
      inspectionObjectStandardsRoleNotNull: check(
        "inspection_object_standards_role_not_null",
        sql`NOT NULL role`,
      ),
      inspectionObjectStandardsCreatedAtNotNull: check(
        "inspection_object_standards_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionObjectStandardsUpdatedAtNotNull: check(
        "inspection_object_standards_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionParamInterfaceLinks = pgTable(
  "inspection_param_interface_links",
  {
    inspectionParameterCode: text("inspection_parameter_code").notNull(),
    paramInterfaceCode: text("param_interface_code").notNull(),
    reportNameCode: text("report_name_code"),
    config: jsonb(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxPilParam: index("idx_pil_param").using(
        "btree",
        table.inspectionParameterCode.asc().nullsLast().op("text_ops"),
      ),
      pilParamFk: foreignKey({
        columns: [table.inspectionParameterCode],
        foreignColumns: [inspectionParameters.code],
        name: "pil_param_fk",
      }).onDelete("cascade"),
      pilInterfaceFk: foreignKey({
        columns: [table.paramInterfaceCode],
        foreignColumns: [inspectionParamInterfaces.code],
        name: "pil_interface_fk",
      }).onDelete("cascade"),
      pilReportFk: foreignKey({
        columns: [table.reportNameCode],
        foreignColumns: [inspectionReportNames.code],
        name: "pil_report_fk",
      }).onDelete("set null"),
      paramInterfaceLinksPkey: primaryKey({
        columns: [table.inspectionParameterCode, table.paramInterfaceCode],
        name: "param_interface_links_pkey",
      }),
      inspectionParamInterfaceLInspectionParameterCodeNotNull: check(
        "inspection_param_interface_l_inspection_parameter_code_not_null",
        sql`NOT NULL inspection_parameter_code`,
      ),
      inspectionParamInterfaceLinksParamInterfaceCodeNotNull: check(
        "inspection_param_interface_links_param_interface_code_not_null",
        sql`NOT NULL param_interface_code`,
      ),
      inspectionParamInterfaceLinksCreatedAtNotNull: check(
        "inspection_param_interface_links_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionParamInterfaceLinksUpdatedAtNotNull: check(
        "inspection_param_interface_links_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionReportNameStandards = pgTable(
  "inspection_report_name_standards",
  {
    reportNameCode: text("report_name_code").notNull(),
    inspectionStandardCode: text("inspection_standard_code").notNull(),
    role: text().notNull(),
    remark: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxRnStdReport: index("idx_rn_std_report").using(
        "btree",
        table.reportNameCode.asc().nullsLast().op("text_ops"),
      ),
      rnStdReportFk: foreignKey({
        columns: [table.reportNameCode],
        foreignColumns: [inspectionReportNames.code],
        name: "rn_std_report_fk",
      }).onDelete("cascade"),
      rnStdStandardFk: foreignKey({
        columns: [table.inspectionStandardCode],
        foreignColumns: [inspectionStandards.code],
        name: "rn_std_standard_fk",
      }).onDelete("cascade"),
      inspectionReportNameStandardsPkey: primaryKey({
        columns: [table.inspectionStandardCode, table.reportNameCode, table.role],
        name: "inspection_report_name_standards_pkey",
      }),
      ckRnStdRole: check(
        "ck_rn_std_role",
        sql`role = ANY (ARRAY['TESTING'::text, 'JUDGMENT'::text])`,
      ),
      inspectionReportNameStandardsReportNameCodeNotNull: check(
        "inspection_report_name_standards_report_name_code_not_null",
        sql`NOT NULL report_name_code`,
      ),
      inspectionReportNameStandaInspectionStandardCodeNotNull: check(
        "inspection_report_name_standa_inspection_standard_code_not_null",
        sql`NOT NULL inspection_standard_code`,
      ),
      inspectionReportNameStandardsRoleNotNull: check(
        "inspection_report_name_standards_role_not_null",
        sql`NOT NULL role`,
      ),
      inspectionReportNameStandardsCreatedAtNotNull: check(
        "inspection_report_name_standards_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionReportNameStandardsUpdatedAtNotNull: check(
        "inspection_report_name_standards_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionObjectParameters = pgTable(
  "inspection_object_parameters",
  {
    inspectionObjectCode: text("inspection_object_code").notNull(),
    inspectionParameterCode: text("inspection_parameter_code").notNull(),
    qualificationLevel: text("qualification_level").default("QUALIFIED").notNull(),
    sourcePage: integer("source_page"),
    remark: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxObjParamsObject: index("idx_obj_params_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      idxObjParamsParam: index("idx_obj_params_param").using(
        "btree",
        table.inspectionParameterCode.asc().nullsLast().op("text_ops"),
      ),
      objParamsObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "obj_params_object_fk",
      }).onDelete("cascade"),
      objParamsParameterFk: foreignKey({
        columns: [table.inspectionParameterCode],
        foreignColumns: [inspectionParameters.code],
        name: "obj_params_parameter_fk",
      }).onDelete("cascade"),
      inspectionObjectParametersPkey: primaryKey({
        columns: [table.inspectionObjectCode, table.inspectionParameterCode],
        name: "inspection_object_parameters_pkey",
      }),
      ckObjParamsQualLevel: check(
        "ck_obj_params_qual_level",
        sql`qualification_level = ANY (ARRAY['QUALIFIED'::text, 'RESTRICTED'::text])`,
      ),
      inspectionObjectParametersInspectionObjectCodeNotNull: check(
        "inspection_object_parameters_inspection_object_code_not_null",
        sql`NOT NULL inspection_object_code`,
      ),
      inspectionObjectParametersInspectionParameterCodeNotNull: check(
        "inspection_object_parameters_inspection_parameter_code_not_null",
        sql`NOT NULL inspection_parameter_code`,
      ),
      inspectionObjectParametersQualificationLevelNotNull: check(
        "inspection_object_parameters_qualification_level_not_null",
        sql`NOT NULL qualification_level`,
      ),
      inspectionObjectParametersCreatedAtNotNull: check(
        "inspection_object_parameters_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionObjectParametersUpdatedAtNotNull: check(
        "inspection_object_parameters_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionCalculationMethods = pgTable(
  "inspection_calculation_methods",
  {
    inspectionObjectCode: text("inspection_object_code").notNull(),
    inspectionParameterCode: text("inspection_parameter_code").notNull(),
    testingStandardCode: text("testing_standard_code"),
    reportNameCode: text("report_name_code"),
    algorithmType: text("algorithm_type").default("manual").notNull(),
    specimenCount: integer("specimen_count").default(1).notNull(),
    formula: text(),
    conditions: text(),
    roundingRule: text("rounding_rule"),
    remark: text(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxCalcMethodObject: index("idx_calc_method_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      calcRuleObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "calc_rule_object_fk",
      }).onDelete("cascade"),
      calcRuleParameterFk: foreignKey({
        columns: [table.inspectionParameterCode],
        foreignColumns: [inspectionParameters.code],
        name: "calc_rule_parameter_fk",
      }).onDelete("cascade"),
      calcRuleStandardFk: foreignKey({
        columns: [table.testingStandardCode],
        foreignColumns: [inspectionStandards.code],
        name: "calc_rule_standard_fk",
      }).onDelete("set null"),
      calcRuleReportFk: foreignKey({
        columns: [table.reportNameCode],
        foreignColumns: [inspectionReportNames.code],
        name: "calc_rule_report_fk",
      }).onDelete("set null"),
      inspectionCalculationRulesPkey: primaryKey({
        columns: [table.inspectionObjectCode, table.inspectionParameterCode],
        name: "inspection_calculation_rules_pkey",
      }),
      ckCalcAlgorithmType: check(
        "ck_calc_algorithm_type",
        sql`algorithm_type = ANY (ARRAY['simple_avg'::text, 'compressive_strength'::text, 'flexural_strength'::text, 'steel_tensile'::text, 'formula'::text, 'manual'::text, 'auto_calc_ratio'::text])`,
      ),
      inspectionCalculationMethodsInspectionObjectCodeNotNull: check(
        "inspection_calculation_methods_inspection_object_code_not_null",
        sql`NOT NULL inspection_object_code`,
      ),
      inspectionCalculationMethoInspectionParameterCodeNotNull: check(
        "inspection_calculation_metho_inspection_parameter_code_not_null",
        sql`NOT NULL inspection_parameter_code`,
      ),
      inspectionCalculationMethodsAlgorithmTypeNotNull: check(
        "inspection_calculation_methods_algorithm_type_not_null",
        sql`NOT NULL algorithm_type`,
      ),
      inspectionCalculationMethodsSpecimenCountNotNull: check(
        "inspection_calculation_methods_specimen_count_not_null",
        sql`NOT NULL specimen_count`,
      ),
      inspectionCalculationMethodsSortOrderNotNull: check(
        "inspection_calculation_methods_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionCalculationMethodsCreatedAtNotNull: check(
        "inspection_calculation_methods_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionCalculationMethodsUpdatedAtNotNull: check(
        "inspection_calculation_methods_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const inspectionTechnicalRequirements = pgTable(
  "inspection_technical_requirements",
  {
    inspectionObjectCode: text("inspection_object_code").notNull(),
    inspectionParameterCode: text("inspection_parameter_code").notNull(),
    judgmentStandardCode: text("judgment_standard_code").notNull(),
    conditions: text(),
    valueType: text("value_type").default("numeric").notNull(),
    minValue: numeric("min_value", { precision: 12, scale: 4 }),
    maxValue: numeric("max_value", { precision: 12, scale: 4 }),
    targetValue: text("target_value"),
    expression: text(),
    unit: text(),
    comparison: text().notNull(),
    judgmentMode: text("judgment_mode").default("manual").notNull(),
    verificationStatus: text("verification_status").default("draft").notNull(),
    clause: text(),
    sourcePage: integer("source_page"),
    sourceHash: text("source_hash"),
    brand: text(),
    model: text(),
    grade: text(),
    spec: text(),
    sieve: text(),
    remark: text(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxTechReqObject: index("idx_tech_req_object").using(
        "btree",
        table.inspectionObjectCode.asc().nullsLast().op("text_ops"),
      ),
      idxTechReqParameter: index("idx_tech_req_parameter").using(
        "btree",
        table.inspectionParameterCode.asc().nullsLast().op("text_ops"),
      ),
      techReqObjectFk: foreignKey({
        columns: [table.inspectionObjectCode],
        foreignColumns: [inspectionObjects.code],
        name: "tech_req_object_fk",
      }).onDelete("cascade"),
      techReqParameterFk: foreignKey({
        columns: [table.inspectionParameterCode],
        foreignColumns: [inspectionParameters.code],
        name: "tech_req_parameter_fk",
      }).onDelete("cascade"),
      techReqJudgmentStandardFk: foreignKey({
        columns: [table.judgmentStandardCode],
        foreignColumns: [inspectionStandards.code],
        name: "tech_req_judgment_standard_fk",
      }).onDelete("restrict"),
      techReqBrandFk: foreignKey({
        columns: [table.brand],
        foreignColumns: [inspectionBrands.code],
        name: "tech_req_brand_fk",
      }).onDelete("set null"),
      techReqModelFk: foreignKey({
        columns: [table.model],
        foreignColumns: [inspectionModels.code],
        name: "tech_req_model_fk",
      }).onDelete("set null"),
      techReqGradeFk: foreignKey({
        columns: [table.grade],
        foreignColumns: [inspectionGrades.code],
        name: "tech_req_grade_fk",
      }).onDelete("set null"),
      techReqSpecFk: foreignKey({
        columns: [table.spec],
        foreignColumns: [inspectionSpecs.code],
        name: "tech_req_spec_fk",
      }).onDelete("set null"),
      inspectionTechnicalRequirementsPkey: primaryKey({
        columns: [
          table.inspectionObjectCode,
          table.inspectionParameterCode,
          table.judgmentStandardCode,
        ],
        name: "inspection_technical_requirements_pkey",
      }),
      ckTechReqValueType: check(
        "ck_tech_req_value_type",
        sql`value_type = ANY (ARRAY['numeric'::text, 'string'::text, 'range'::text, 'formula'::text, 'manual'::text])`,
      ),
      ckTechReqComparison: check(
        "ck_tech_req_comparison",
        sql`comparison = ANY (ARRAY['≥'::text, '≤'::text, '='::text, 'range'::text, 'eq'::text])`,
      ),
      ckTechReqJudgmentMode: check(
        "ck_tech_req_judgment_mode",
        sql`judgment_mode = ANY (ARRAY['automatic'::text, 'manual'::text])`,
      ),
      ckTechReqVerificationStatus: check(
        "ck_tech_req_verification_status",
        sql`verification_status = ANY (ARRAY['draft'::text, 'reviewed'::text, 'verified'::text, 'rejected'::text])`,
      ),
      inspectionTechnicalRequiremenInspectionObjectCodeNotNull: check(
        "inspection_technical_requiremen_inspection_object_code_not_null",
        sql`NOT NULL inspection_object_code`,
      ),
      inspectionTechnicalRequireInspectionParameterCodeNotNull: check(
        "inspection_technical_require_inspection_parameter_code_not_null",
        sql`NOT NULL inspection_parameter_code`,
      ),
      inspectionTechnicalRequiremenJudgmentStandardCodeNotNull: check(
        "inspection_technical_requiremen_judgment_standard_code_not_null",
        sql`NOT NULL judgment_standard_code`,
      ),
      inspectionTechnicalRequirementsValueTypeNotNull: check(
        "inspection_technical_requirements_value_type_not_null",
        sql`NOT NULL value_type`,
      ),
      inspectionTechnicalRequirementsComparisonNotNull: check(
        "inspection_technical_requirements_comparison_not_null",
        sql`NOT NULL comparison`,
      ),
      inspectionTechnicalRequirementsJudgmentModeNotNull: check(
        "inspection_technical_requirements_judgment_mode_not_null",
        sql`NOT NULL judgment_mode`,
      ),
      inspectionTechnicalRequirementsVerificationStatusNotNull: check(
        "inspection_technical_requirements_verification_status_not_null",
        sql`NOT NULL verification_status`,
      ),
      inspectionTechnicalRequirementsSortOrderNotNull: check(
        "inspection_technical_requirements_sort_order_not_null",
        sql`NOT NULL sort_order`,
      ),
      inspectionTechnicalRequirementsCreatedAtNotNull: check(
        "inspection_technical_requirements_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      inspectionTechnicalRequirementsUpdatedAtNotNull: check(
        "inspection_technical_requirements_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);
