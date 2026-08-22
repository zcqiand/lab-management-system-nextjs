import { pgTable, index, uniqueIndex, foreignKey, text, integer, boolean, jsonb, timestamp, primaryKey, pgEnum } from "drizzle-orm/pg-core"

export const auditAction = pgEnum("audit_action", ['login', 'logout', 'create', 'update', 'delete', 'flow', 'export', 'other'])
export const calculationAlgorithmType = pgEnum("calculation_algorithm_type", ['simple_avg', 'compressive_strength', 'flexural_strength', 'steel_tensile', 'formula', 'manual', 'auto_calc_ratio'])
export const contractStatus = pgEnum("contract_status", ['active', 'archived'])
export const flowStatus = pgEnum("flow_status", ['receiving', 'task_assignment', 'data_entry', 'review', 'approval', 'issuance', 'archived', 'completed'])
export const inspectionParameterSourceType = pgEnum("inspection_parameter_source_type", ['official', 'custom'])
export const inspectionStandardRole = pgEnum("inspection_standard_role", ['TESTING', 'JUDGMENT'])
export const inspectionStandardStatus = pgEnum("inspection_standard_status", ['active', 'superseded', 'draft'])
export const qualificationLevel = pgEnum("qualification_level", ['QUALIFIED', 'RESTRICTED'])
export const receiptResult = pgEnum("receipt_result", ['pass', 'fail', ''])
export const requirementComparison = pgEnum("requirement_comparison", ['≥', '≤', '=', 'range', 'eq'])
export const requirementJudgmentMode = pgEnum("requirement_judgment_mode", ['automatic', 'manual'])
export const requirementValueType = pgEnum("requirement_value_type", ['numeric', 'string', 'range', 'formula', 'manual'])
export const requirementVerificationStatus = pgEnum("requirement_verification_status", ['draft', 'reviewed', 'verified', 'rejected'])


export const inspectionBrands = pgTable("inspection_brands", {
	code: text().primaryKey().notNull(),
	inspectionObjectCode: text("inspection_object_code"),
	name: text().notNull(),
	remark: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxBrandsTenant: index("idx_brands_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		idxBrandsTenantCode: uniqueIndex("idx_brands_tenant_code").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
		idxInspectionBrandsObject: index("idx_inspection_brands_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		idxInspectionBrandsSort: index("idx_inspection_brands_sort").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
		brandsObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "brands_object_fk"
		}).onDelete("set null"),
	}
});

export const inspectionSpecialties = pgTable("inspection_specialties", {
	code: text().primaryKey().notNull(),
	officialNo: text("official_no").notNull(),
	name: text().notNull(),
	isOfficial: boolean("is_official").default(true).notNull(),
	enabled: boolean().default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
});

export const inspectionObjects = pgTable("inspection_objects", {
	code: text().primaryKey().notNull(),
	inspectionSpecialtyCode: text("inspection_specialty_code").notNull(),
	sourceProjectNo: text("source_project_no").notNull(),
	sourceProjectName: text("source_project_name").notNull(),
	name: text().notNull(),
	isOptionalForQualification: boolean("is_optional_for_qualification").default(false).notNull(),
	isOfficial: boolean("is_official").default(true).notNull(),
	enabled: boolean().default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxObjectsSpecialty: index("idx_objects_specialty").using("btree", table.inspectionSpecialtyCode.asc().nullsLast().op("text_ops")),
		objectsSpecialtyFk: foreignKey({
			columns: [table.inspectionSpecialtyCode],
			foreignColumns: [inspectionSpecialties.code],
			name: "objects_specialty_fk"
		}).onDelete("restrict"),
	}
});

export const inspectionParameters = pgTable("inspection_parameters", {
	code: text().primaryKey().notNull(),
	name: text().notNull(),
	rawName: text("raw_name").notNull(),
	canonicalName: text("canonical_name").notNull(),
	methodText: text("method_text"),
	aliases: jsonb().default([]).notNull(),
	unit: text(),
	sourceType: inspectionParameterSourceType("source_type").default('official').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
});

export const inspectionStandards = pgTable("inspection_standards", {
	code: text().primaryKey().notNull(),
	name: text().notNull(),
	version: text(),
	status: inspectionStandardStatus().default('active').notNull(),
	sourceDocumentId: text("source_document_id"),
	sourceHash: text("source_hash"),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
});

export const inspectionReportNames = pgTable("inspection_report_names", {
	code: text().primaryKey().notNull(),
	name: text().notNull(),
	fullName: text("full_name"),
	templatePath: text("template_path"),
	summaryName: text("summary_name"),
	extFields: jsonb("ext_fields"),
	description: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
});

export const inspectionParamInterfaces = pgTable("inspection_param_interfaces", {
	code: text().primaryKey().notNull(),
	name: text(),
	componentPath: text("component_path").notNull(),
	description: text(),
	isOfficial: boolean("is_official"),
	sortOrder: integer("sort_order").default(0).notNull(),
	config: jsonb(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
});

export const inspectionModels = pgTable("inspection_models", {
	code: text().primaryKey().notNull(),
	inspectionObjectCode: text("inspection_object_code"),
	name: text().notNull(),
	remark: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxInspectionModelsObject: index("idx_inspection_models_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		idxInspectionModelsSort: index("idx_inspection_models_sort").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
		idxModelsTenant: index("idx_models_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		idxModelsTenantCode: uniqueIndex("idx_models_tenant_code").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
		modelsObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "models_object_fk"
		}).onDelete("set null"),
	}
});

export const inspectionSpecs = pgTable("inspection_specs", {
	code: text().primaryKey().notNull(),
	inspectionObjectCode: text("inspection_object_code"),
	name: text().notNull(),
	remark: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxInspectionSpecsObject: index("idx_inspection_specs_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		idxInspectionSpecsSort: index("idx_inspection_specs_sort").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
		idxSpecsTenant: index("idx_specs_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		idxSpecsTenantCode: uniqueIndex("idx_specs_tenant_code").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
		specsObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "specs_object_fk"
		}).onDelete("set null"),
	}
});

export const inspectionGrades = pgTable("inspection_grades", {
	code: text().primaryKey().notNull(),
	inspectionObjectCode: text("inspection_object_code"),
	name: text().notNull(),
	remark: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxGradesTenant: index("idx_grades_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		idxGradesTenantCode: uniqueIndex("idx_grades_tenant_code").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
		idxInspectionGradesObject: index("idx_inspection_grades_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		idxInspectionGradesSort: index("idx_inspection_grades_sort").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
		gradesObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "grades_object_fk"
		}).onDelete("set null"),
	}
});

export const auditEvents = pgTable("audit_events", {
	id: text().primaryKey().notNull(),
	action: auditAction().notNull(),
	operator: text().notNull(),
	target: text().notNull(),
	targetId: text("target_id"),
	detail: text(),
	ip: text(),
	at: text().notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxAuditEventsAt: index("idx_audit_events_at").using("btree", table.at.asc().nullsLast().op("text_ops")),
		idxAuditEventsOperator: index("idx_audit_events_operator").using("btree", table.operator.asc().nullsLast().op("text_ops")),
		idxAuditEventsTarget: index("idx_audit_events_target").using("btree", table.target.asc().nullsLast().op("text_ops"), table.targetId.asc().nullsLast().op("text_ops")),
		idxAuditEventsTenant: index("idx_audit_events_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	}
});

export const contracts = pgTable("contracts", {
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
	status: contractStatus().default('active').notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxContractsStatus: index("idx_contracts_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
		idxContractsTenant: index("idx_contracts_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		idxContractsTenantCode: uniqueIndex("idx_contracts_tenant_code").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.contractCode.asc().nullsLast().op("text_ops")),
		contractsSpecialtyFk: foreignKey({
			columns: [table.inspectionSpecialtyCode],
			foreignColumns: [inspectionSpecialties.code],
			name: "contracts_specialty_fk"
		}).onDelete("set null"),
	}
});

export const sampleReceipts = pgTable("sample_receipts", {
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
	flowStatus: flowStatus("flow_status").default('receiving').notNull(),
	flowHistory: jsonb("flow_history").default([]).notNull(),
	lastSubmittedBy: text("last_submitted_by"),
	assigneeId: text("assignee_id"),
	assigneeName: text("assignee_name"),
	plannedTestDate: text("planned_test_date"),
	reportCode: text("report_code"),
	reportDate: text("report_date"),
	conclusion: text(),
	result: receiptResult().default(''),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxReceiptsTenant: index("idx_receipts_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		idxReceiptsTenantCommission: uniqueIndex("idx_receipts_tenant_commission").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.commissionCode.asc().nullsLast().op("text_ops")),
		idxSampleReceiptsCategory: index("idx_sample_receipts_category").using("btree", table.categoryCode.asc().nullsLast().op("text_ops")),
		idxSampleReceiptsContract: index("idx_sample_receipts_contract").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
		idxSampleReceiptsFlowStatus: index("idx_sample_receipts_flow_status").using("btree", table.flowStatus.asc().nullsLast().op("enum_ops")),
		receiptsCategoryFk: foreignKey({
			columns: [table.categoryCode],
			foreignColumns: [inspectionReportNames.code],
			name: "receipts_category_fk"
		}).onDelete("restrict"),
		sampleReceiptsContractFk: foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "sample_receipts_contract_fk"
		}).onDelete("restrict"),
	}
});

export const samples = pgTable("samples", {
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
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxSamplesReceipt: index("idx_samples_receipt").using("btree", table.receiptId.asc().nullsLast().op("text_ops")),
		idxSamplesTenant: index("idx_samples_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		samplesReceiptFk: foreignKey({
			columns: [table.receiptId],
			foreignColumns: [sampleReceipts.id],
			name: "samples_receipt_fk"
		}).onDelete("cascade"),
	}
});

export const testRecords = pgTable("test_records", {
	id: text().primaryKey().notNull(),
	sampleId: text("sample_id").notNull(),
	parameterCode: text("parameter_code").notNull(),
	standardCode: text("standard_code"),
	requirementCode: text("requirement_code"),
	requirement: text().notNull(),
	result: text().notNull(),
	verdict: text(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxTestRecordsParameter: index("idx_test_records_parameter").using("btree", table.parameterCode.asc().nullsLast().op("text_ops")),
		idxTestRecordsSample: index("idx_test_records_sample").using("btree", table.sampleId.asc().nullsLast().op("text_ops")),
		idxTestRecordsTenant: index("idx_test_records_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		testrecParamFk: foreignKey({
			columns: [table.parameterCode],
			foreignColumns: [inspectionParameters.code],
			name: "testrec_param_fk"
		}).onDelete("restrict"),
		testrecStandardFk: foreignKey({
			columns: [table.standardCode],
			foreignColumns: [inspectionStandards.code],
			name: "testrec_standard_fk"
		}).onDelete("set null"),
		testRecordsSampleFk: foreignKey({
			columns: [table.sampleId],
			foreignColumns: [samples.id],
			name: "test_records_sample_fk"
		}).onDelete("cascade"),
	}
});

export const inspectionStandardParameters = pgTable("inspection_standard_parameters", {
	inspectionStandardCode: text("inspection_standard_code").notNull(),
	inspectionParameterCode: text("inspection_parameter_code").notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxStdParamStandard: index("idx_std_param_standard").using("btree", table.inspectionStandardCode.asc().nullsLast().op("text_ops")),
		stdParamStandardFk: foreignKey({
			columns: [table.inspectionStandardCode],
			foreignColumns: [inspectionStandards.code],
			name: "std_param_standard_fk"
		}).onDelete("cascade"),
		stdParamParameterFk: foreignKey({
			columns: [table.inspectionParameterCode],
			foreignColumns: [inspectionParameters.code],
			name: "std_param_parameter_fk"
		}).onDelete("cascade"),
		inspectionStandardParametersPkey: primaryKey({ columns: [table.inspectionStandardCode, table.inspectionParameterCode], name: "inspection_standard_parameters_pkey"}),
	}
});

export const inspectionSpecialtyObjects = pgTable("inspection_specialty_objects", {
	inspectionSpecialtyCode: text("inspection_specialty_code").notNull(),
	inspectionObjectCode: text("inspection_object_code").notNull(),
	remark: text(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		specialtyObjectsSpecialtyFk: foreignKey({
			columns: [table.inspectionSpecialtyCode],
			foreignColumns: [inspectionSpecialties.code],
			name: "specialty_objects_specialty_fk"
		}).onDelete("cascade"),
		specialtyObjectsObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "specialty_objects_object_fk"
		}).onDelete("cascade"),
		inspectionSpecialtyObjectsPkey: primaryKey({ columns: [table.inspectionSpecialtyCode, table.inspectionObjectCode], name: "inspection_specialty_objects_pkey"}),
	}
});

export const inspectionObjectReportNames = pgTable("inspection_object_report_names", {
	inspectionObjectCode: text("inspection_object_code").notNull(),
	reportNameCode: text("report_name_code").notNull(),
	remark: text(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxObjRnObject: index("idx_obj_rn_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		objRnObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "obj_rn_object_fk"
		}).onDelete("cascade"),
		objRnReportFk: foreignKey({
			columns: [table.reportNameCode],
			foreignColumns: [inspectionReportNames.code],
			name: "obj_rn_report_fk"
		}).onDelete("cascade"),
		inspectionObjectReportNamesPkey: primaryKey({ columns: [table.inspectionObjectCode, table.reportNameCode], name: "inspection_object_report_names_pkey"}),
	}
});

export const inspectionReportNameParameters = pgTable("inspection_report_name_parameters", {
	reportNameCode: text("report_name_code").notNull(),
	inspectionParameterCode: text("inspection_parameter_code").notNull(),
	remark: text(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxRnParamReport: index("idx_rn_param_report").using("btree", table.reportNameCode.asc().nullsLast().op("text_ops")),
		rnParamReportFk: foreignKey({
			columns: [table.reportNameCode],
			foreignColumns: [inspectionReportNames.code],
			name: "rn_param_report_fk"
		}).onDelete("cascade"),
		rnParamParameterFk: foreignKey({
			columns: [table.inspectionParameterCode],
			foreignColumns: [inspectionParameters.code],
			name: "rn_param_parameter_fk"
		}).onDelete("cascade"),
		inspectionReportNameParametersPkey: primaryKey({ columns: [table.reportNameCode, table.inspectionParameterCode], name: "inspection_report_name_parameters_pkey"}),
	}
});

export const inspectionObjectStandards = pgTable("inspection_object_standards", {
	inspectionObjectCode: text("inspection_object_code").notNull(),
	inspectionStandardCode: text("inspection_standard_code").notNull(),
	role: inspectionStandardRole().notNull(),
	remark: text(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxObjStdObject: index("idx_obj_std_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		objStdObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "obj_std_object_fk"
		}).onDelete("cascade"),
		objStdStandardFk: foreignKey({
			columns: [table.inspectionStandardCode],
			foreignColumns: [inspectionStandards.code],
			name: "obj_std_standard_fk"
		}).onDelete("cascade"),
		inspectionObjectStandardsPkey: primaryKey({ columns: [table.inspectionObjectCode, table.inspectionStandardCode, table.role], name: "inspection_object_standards_pkey"}),
	}
});

export const inspectionReportNameStandards = pgTable("inspection_report_name_standards", {
	reportNameCode: text("report_name_code").notNull(),
	inspectionStandardCode: text("inspection_standard_code").notNull(),
	role: inspectionStandardRole().notNull(),
	remark: text(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxRnStdReport: index("idx_rn_std_report").using("btree", table.reportNameCode.asc().nullsLast().op("text_ops")),
		rnStdReportFk: foreignKey({
			columns: [table.reportNameCode],
			foreignColumns: [inspectionReportNames.code],
			name: "rn_std_report_fk"
		}).onDelete("cascade"),
		rnStdStandardFk: foreignKey({
			columns: [table.inspectionStandardCode],
			foreignColumns: [inspectionStandards.code],
			name: "rn_std_standard_fk"
		}).onDelete("cascade"),
		inspectionReportNameStandardsPkey: primaryKey({ columns: [table.reportNameCode, table.inspectionStandardCode, table.role], name: "inspection_report_name_standards_pkey"}),
	}
});

export const inspectionParamInterfaceLinks = pgTable("inspection_param_interface_links", {
	inspectionParameterCode: text("inspection_parameter_code").notNull(),
	paramInterfaceCode: text("param_interface_code").notNull(),
	reportNameCode: text("report_name_code"),
	config: jsonb(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxPilParam: index("idx_pil_param").using("btree", table.inspectionParameterCode.asc().nullsLast().op("text_ops")),
		pilParamFk: foreignKey({
			columns: [table.inspectionParameterCode],
			foreignColumns: [inspectionParameters.code],
			name: "pil_param_fk"
		}).onDelete("cascade"),
		pilInterfaceFk: foreignKey({
			columns: [table.paramInterfaceCode],
			foreignColumns: [inspectionParamInterfaces.code],
			name: "pil_interface_fk"
		}).onDelete("cascade"),
		pilReportFk: foreignKey({
			columns: [table.reportNameCode],
			foreignColumns: [inspectionReportNames.code],
			name: "pil_report_fk"
		}).onDelete("set null"),
		paramInterfaceLinksPkey: primaryKey({ columns: [table.inspectionParameterCode, table.paramInterfaceCode], name: "param_interface_links_pkey"}),
	}
});

export const inspectionObjectParameters = pgTable("inspection_object_parameters", {
	inspectionObjectCode: text("inspection_object_code").notNull(),
	inspectionParameterCode: text("inspection_parameter_code").notNull(),
	qualificationLevel: qualificationLevel("qualification_level").default('QUALIFIED').notNull(),
	sourcePage: integer("source_page"),
	remark: text(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxObjParamsObject: index("idx_obj_params_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		idxObjParamsParam: index("idx_obj_params_param").using("btree", table.inspectionParameterCode.asc().nullsLast().op("text_ops")),
		objParamsObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "obj_params_object_fk"
		}).onDelete("cascade"),
		objParamsParameterFk: foreignKey({
			columns: [table.inspectionParameterCode],
			foreignColumns: [inspectionParameters.code],
			name: "obj_params_parameter_fk"
		}).onDelete("cascade"),
		inspectionObjectParametersPkey: primaryKey({ columns: [table.inspectionObjectCode, table.inspectionParameterCode], name: "inspection_object_parameters_pkey"}),
	}
});

export const inspectionCalculationRules = pgTable("inspection_calculation_rules", {
	inspectionObjectCode: text("inspection_object_code").notNull(),
	inspectionParameterCode: text("inspection_parameter_code").notNull(),
	testingStandardCode: text("testing_standard_code"),
	reportNameCode: text("report_name_code"),
	algorithmType: calculationAlgorithmType("algorithm_type").default('manual').notNull(),
	specimenCount: integer("specimen_count").default(1).notNull(),
	formula: text(),
	conditions: text(),
	roundingRule: text("rounding_rule"),
	remark: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
}, (table) => {
	return {
		idxCalcRuleObject: index("idx_calc_rule_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		calcRuleObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "calc_rule_object_fk"
		}).onDelete("cascade"),
		calcRuleParameterFk: foreignKey({
			columns: [table.inspectionParameterCode],
			foreignColumns: [inspectionParameters.code],
			name: "calc_rule_parameter_fk"
		}).onDelete("cascade"),
		calcRuleStandardFk: foreignKey({
			columns: [table.testingStandardCode],
			foreignColumns: [inspectionStandards.code],
			name: "calc_rule_standard_fk"
		}).onDelete("set null"),
		calcRuleReportFk: foreignKey({
			columns: [table.reportNameCode],
			foreignColumns: [inspectionReportNames.code],
			name: "calc_rule_report_fk"
		}).onDelete("set null"),
		inspectionCalculationRulesPkey: primaryKey({ columns: [table.inspectionObjectCode, table.inspectionParameterCode], name: "inspection_calculation_rules_pkey"}),
	}
});

export const inspectionTechnicalRequirements = pgTable("inspection_technical_requirements", {
	inspectionObjectCode: text("inspection_object_code").notNull(),
	inspectionParameterCode: text("inspection_parameter_code").notNull(),
	judgmentStandardCode: text("judgment_standard_code").notNull(),
	conditions: text(),
	valueType: requirementValueType("value_type").default('numeric').notNull(),
	minValue: integer("min_value"),
	maxValue: integer("max_value"),
	targetValue: text("target_value"),
	expression: text(),
	unit: text(),
	comparison: requirementComparison().default('≥').notNull(),
	judgmentMode: requirementJudgmentMode("judgment_mode").default('manual').notNull(),
	verificationStatus: requirementVerificationStatus("verification_status").default('draft').notNull(),
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
	createdAt: text("created_at").default('').notNull(),
	updatedAt: text("updated_at").default('').notNull(),
	tenantId: text("tenant_id").default('').notNull(),
}, (table) => {
	return {
		idxTechReqObject: index("idx_tech_req_object").using("btree", table.inspectionObjectCode.asc().nullsLast().op("text_ops")),
		idxTechReqParameter: index("idx_tech_req_parameter").using("btree", table.inspectionParameterCode.asc().nullsLast().op("text_ops")),
		idxTechReqTenant: index("idx_tech_req_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
		techReqBrandFk: foreignKey({
			columns: [table.brand],
			foreignColumns: [inspectionBrands.code],
			name: "tech_req_brand_fk"
		}).onDelete("set null"),
		techReqModelFk: foreignKey({
			columns: [table.model],
			foreignColumns: [inspectionModels.code],
			name: "tech_req_model_fk"
		}).onDelete("set null"),
		techReqGradeFk: foreignKey({
			columns: [table.grade],
			foreignColumns: [inspectionGrades.code],
			name: "tech_req_grade_fk"
		}).onDelete("set null"),
		techReqSpecFk: foreignKey({
			columns: [table.spec],
			foreignColumns: [inspectionSpecs.code],
			name: "tech_req_spec_fk"
		}).onDelete("set null"),
		techReqObjectFk: foreignKey({
			columns: [table.inspectionObjectCode],
			foreignColumns: [inspectionObjects.code],
			name: "tech_req_object_fk"
		}).onDelete("cascade"),
		techReqParameterFk: foreignKey({
			columns: [table.inspectionParameterCode],
			foreignColumns: [inspectionParameters.code],
			name: "tech_req_parameter_fk"
		}).onDelete("cascade"),
		techReqJudgmentStandardFk: foreignKey({
			columns: [table.judgmentStandardCode],
			foreignColumns: [inspectionStandards.code],
			name: "tech_req_judgment_standard_fk"
		}).onDelete("restrict"),
		inspectionTechnicalRequirementsPkey: primaryKey({ columns: [table.inspectionObjectCode, table.inspectionParameterCode, table.judgmentStandardCode], name: "inspection_technical_requirements_pkey"}),
	}
});
