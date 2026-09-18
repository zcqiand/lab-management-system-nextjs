# 设计与功能对齐 — 建筑工程实验室管理系统-Next.js

> 人填、人评审。机器只检查功能 ID 存在性。
> 回答一个问题：**这个功能子项，落到哪段代码、哪张表、哪个权限码上？**
> 答不上来的行，说明设计没做完，别开工。

## 映射表

| 功能子项 ID | 页面/组件 | 接口 | 数据表 | 权限码 | 设计稿 | 状态 |
|---|---|---|---|---|---|---|
| M02.F01.I01 | src/app/contracts/page.tsx | GET /api/contracts | contracts | M02.F01.I01 | – | 已上线 |
| M02.F01.I02 | src/app/contracts/page.tsx (Dialog) | POST /api/contracts ; PUT /api/contracts/:id | contracts | M02.F01.I02 | – | 已上线 |
| M02.F01.I05 | src/app/contracts/page.tsx (行内删除) | DELETE /api/contracts/:id | contracts | M02.F01.I05 | – | 已上线 |
| M03.F01.I01 | src/app/receipts/page.tsx | GET /api/sample-receipts | sample_receipts | M03.F01.I01 | – | 已上线 |
| M03.F01.I02 | src/app/receipts/page.tsx (新建 Dialog) | POST /api/sample-receipts | sample_receipts | M03.F01.I02 | – | 已上线 |
| M03.F01.I03 | src/app/receipts/page.tsx (编辑 Dialog) | PUT /api/sample-receipts/:id | sample_receipts | M03.F01.I03 | – | 已上线 |
| M03.F01.I04 | src/app/receipts/page.tsx (行内删除) | DELETE /api/sample-receipts/:id | sample_receipts | M03.F01.I04 | – | 已上线 |
| M03.F01.I06 | src/app/receipts/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F01.I06 | – | 已上线 |
| M03.F01.I07 | src/features/data-entry/SampleExtFieldsModal.tsx | PATCH /api/samples/:id (ext JSON) | samples | M03.F01.I07 | – | 已上线 |
| M03.F02.I01 | src/app/task-assignment/page.tsx | GET /api/sample-receipts?stage=task | sample_receipts | M03.F02.I01 | – | 已上线 |
| M03.F02.I02 | src/app/task-assignment/page.tsx (AssignDialog) | PATCH /api/sample-receipts/:id (assignee fields) | sample_receipts | M03.F02.I02 | – | 已上线 |
| M03.F02.I03 | src/app/task-assignment/page.tsx (清空分配按钮) | PATCH /api/sample-receipts/:id (assignee=null) | sample_receipts | M03.F02.I03 | – | 已上线 |
| M03.F02.I04 | src/app/task-assignment/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F02.I04 | – | 已上线 |
| M03.F03.I01 | src/app/data-entry/page.tsx + src/features/data-entry/* | GET /api/test-records?receiptId= | test_records | M03.F03.I01 | – | 已上线 |
| M03.F03.I02 | src/features/data-entry/* (录入卡片保存) | POST /api/test-records | test_records | M03.F03.I02 | – | 已上线 |
| M03.F03.I03 | src/features/data-entry/* (卡片内编辑) | PUT /api/test-records/:id | test_records | M03.F03.I03 | – | 已上线 |
| M03.F03.I10 | src/features/data-entry/* (行内删除) | DELETE /api/test-records/:id | test_records | M03.F03.I10 | – | 已上线 |
| M03.F03.I11 | src/features/data-entry/* (verdict 改判) | PUT /api/test-records/:id/verdict | test_records | M03.F03.I11 | – | 已上线 |
| M03.F03.I07 | src/app/data-entry/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F03.I07 | – | 已上线 |
| M03.F03.I08 | src/app/api/test-records/route.ts (GET) | GET /api/test-records?sampleId=&receiptId= | test_records | M03.F03.I08 | – | 已上线 |
| M03.F03.I09 | src/app/api/test-records/route.ts (POST) | POST /api/test-records | test_records | M03.F03.I09 | – | 已上线 |
| M03.F05.I01 | src/app/report-review/page.tsx | GET /api/receipts?flowStatus=review（listReceipts 共享列表；per-stage 队列端点 2026-09-17 已删，队列数据走前端） | sample_receipts | M03.F05.I01 | – | 已上线 |
| M03.F05.I02 | src/app/report-review/page.tsx (查看报告) | GET /api/sample-receipts/:id?with=report | sample_receipts | M03.F05.I02 | – | 已上线 |
| M03.F05.I07 | src/features/reports/* (审核通过/驳回) | POST /api/receipts/review/act (ADR-0035) | sample_receipts + audit_events | M03.F05.I07 | – | 已上线 |
| M03.F05.I04 | src/app/report-review/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F05.I04 | – | 已上线 |
| M03.F06.I01 | src/app/report-approve/page.tsx | GET /api/receipts?flowStatus=approval（listReceipts 共享列表；per-stage 队列端点 2026-09-17 已删，队列数据走前端） | sample_receipts | M03.F06.I01 | – | 已上线 |
| M03.F06.I02 | src/app/report-approve/page.tsx (查看报告) | GET /api/sample-receipts/:id?with=report | sample_receipts | M03.F06.I02 | – | 已上线 |
| M03.F06.I05 | src/features/reports/* (批准通过/驳回) | POST /api/receipts/approve/act (ADR-0035) | sample_receipts + audit_events | M03.F06.I05 | – | 已上线 |
| M03.F06.I04 | src/app/report-approve/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F06.I04 | – | 已上线 |
| M03.F07.I01 | src/app/report-issue/page.tsx | GET /api/receipts?flowStatus=issuance（listReceipts 共享列表；per-stage 队列端点 2026-09-17 已删，队列数据走前端） | sample_receipts | M03.F07.I01 | – | 已上线 |
| M03.F07.I02 | src/app/report-issue/page.tsx (查看报告) | GET /api/sample-receipts/:id?with=report | sample_receipts | M03.F07.I02 | – | 已上线 |
| M03.F07.I05 | src/features/reports/* (报告发放) | POST /api/receipts/issuance/act (ADR-0035) | sample_receipts + audit_events | M03.F07.I05 | – | 已上线 |
| M03.F07.I04 | src/app/report-issue/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F07.I04 | – | 已上线 |
| M03.F08.I01 | src/app/report-archive/page.tsx | GET /api/receipts?flowStatus=archived（listReceipts 共享列表；per-stage 队列端点 2026-09-17 已删，队列数据走前端） | sample_receipts | M03.F08.I01 | – | 已上线 |
| M03.F08.I02 | src/app/report-archive/page.tsx (查看报告) | GET /api/sample-receipts/:id?with=report | sample_receipts | M03.F08.I02 | – | 已上线 |
| M03.F08.I05 | src/features/reports/* (报告归档) | POST /api/receipts/archived/act (ADR-0035) | sample_receipts + audit_events | M03.F08.I05 | – | 已上线 |
| M03.F08.I04 | src/app/report-archive/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F08.I04 | – | 已上线 |
| M03.F09.I01 | src/features/flow-pipeline/FlowStagePage.tsx (行内查看按钮) | – (路由跳转) | sample_receipts | M03.F09.I01 | – | 已上线 |
| M03.F09.I02 | src/app/receipts/[id]/page.tsx | GET /api/sample-receipts/:id?samples&records&report | sample_receipts + samples + test_records | M03.F09.I02 | – | 已上线 |
| M03.F09.I03 | src/app/receipts/[id]/page.tsx (报告预览按钮) | – (复用 ReportPreviewModal) | sample_receipts | M03.F09.I03 | – | 已上线 |
| M06.F01.I01 | src/features/inspection-capability/InspectionCapabilityPage.tsx (specialties) | GET /api/inspection-specialties | inspection_specialty | M06.F01.I01 | – | 已上线 |
| M06.F01.I02 | src/features/inspection-capability/InspectionCapabilityPage.tsx (specialties 新建/编辑) | POST /api/inspection-specialties ; PUT /api/inspection-specialties/:id | inspection_specialty | M06.F01.I02 | – | 已上线 |
| M06.F01.I04 | src/features/inspection-capability/InspectionCapabilityPage.tsx (specialties 删除) | DELETE /api/inspection/specialties/:code | inspection_specialty | M06.F01.I04 | – | 已上线 |
| M06.F01.I05 | src/app/api/inspection/links/object-standard/route.ts (POST handler；字典 junction 暂无 UI 消费方，锚定端点) | POST /api/inspection/links/object-standard | inspection_object_standard | M06.F01.I05 | – | 已上线 |
| M06.F01.I06 | src/app/api/inspection/links/object-standard/route.ts (DELETE handler；同上，锚定端点) | DELETE /api/inspection/links/object-standard | inspection_object_standard | M06.F01.I06 | – | 已上线 |
| M06.F01.I07 | src/app/api/inspection/links/object-standard/route.ts (GET handler；同上，锚定端点) | GET /api/inspection/links/object-standard?inspectionObjectCode=&role= | inspection_object_standard | M06.F01.I07 | – | 已上线 |
| M06.F02.I01 | src/features/inspection-capability/InspectionCapabilityPage.tsx (objects) | GET /api/inspection-objects | inspection_object | M06.F02.I01 | – | 已上线 |
| M06.F02.I02 | src/features/inspection-capability/InspectionCapabilityPage.tsx (objects 新建/编辑) | POST /api/inspection-objects ; PUT /api/inspection-objects/:id | inspection_object | M06.F02.I02 | – | 已上线 |
| M06.F02.I11 | src/features/inspection-capability/InspectionCapabilityPage.tsx (objects 删除) | DELETE /api/inspection-objects/:id | inspection_object | M06.F02.I11 | – | 规划 |
| M06.F02.I14 | src/features/inspection-capability/AssociationManager.tsx (object↔parameter) | POST /api/inspection-object-parameters ; DELETE 同 | inspection_object_parameter | M06.F02.I14 | – | 规划 |
| M06.F02.I13 | src/features/inspection-capability/InspectionCapabilityFormModal.tsx (specialty↔object) | POST /api/inspection-specialty-objects ; DELETE 同 | inspection_specialty_object | M06.F02.I13 | – | 规划 |
| M06.F02.I08 | src/app/api/inspection/links/object-parameter/route.ts (DELETE handler；字典 junction 暂无 UI 消费方，锚定端点) | DELETE /api/inspection/links/object-parameter | inspection_object_parameter | M06.F02.I08 | – | 已上线 |
| M06.F02.I09 | src/app/api/inspection/links/specialty-object/route.ts (GET handler；同上，锚定端点) | GET /api/inspection/links/specialty-object?inspectionSpecialtyCode= | inspection_specialty_object | M06.F02.I09 | – | 已上线 |
| M06.F02.I10 | src/app/api/inspection/links/object-parameter/route.ts (GET handler；同上，锚定端点) | GET /api/inspection/links/object-parameter?inspectionObjectCode=&inspectionParameterCode= | inspection_object_parameter | M06.F02.I10 | – | 已上线 |
| M06.F03.I01 | src/features/inspection-capability/InspectionCapabilityPage.tsx (parameters) | GET /api/inspection-parameters | inspection_parameter | M06.F03.I01 | – | 已上线 |
| M06.F03.I02 | src/features/inspection-capability/InspectionCapabilityPage.tsx (parameters 新建/编辑) | POST /api/inspection-parameters ; PUT /api/inspection-parameters/:id | inspection_parameter | M06.F03.I02 | – | 已上线 |
| M06.F03.I04 | src/features/inspection-capability/InspectionCapabilityPage.tsx (parameters 删除) | DELETE /api/inspection/parameters/:code | inspection_parameter | M06.F03.I04 | – | 已上线 |
| M06.F03.I05 | src/app/api/inspection/links/standard-parameter/route.ts (POST handler；字典 junction 暂无 UI 消费方，锚定端点) | POST /api/inspection/links/standard-parameter | inspection_standard_parameter | M06.F03.I05 | – | 已上线 |
| M06.F03.I06 | src/app/api/inspection/links/standard-parameter/route.ts (DELETE handler；同上，锚定端点) | DELETE /api/inspection/links/standard-parameter | inspection_standard_parameter | M06.F03.I06 | – | 已上线 |
| M06.F03.I07 | src/features/inspection-capability/ParamInterfaceList.tsx (关联参数页签 unlink) | DELETE /api/param-interfaces/links | inspection_parameter_param_interface | M06.F03.I07 | – | 已上线 |
| M06.F03.I08 | src/app/api/inspection/links/standard-parameter/route.ts (GET handler；同上，锚定端点) | GET /api/inspection/links/standard-parameter?inspectionStandardCode=&inspectionParameterCode= | inspection_standard_parameter | M06.F03.I08 | – | 已上线 |
| M06.F04.I01 | src/features/inspection-capability/InspectionCapabilityPage.tsx (standards) | GET /api/inspection-standards | inspection_standard | M06.F04.I01 | – | 已上线 |
| M06.F04.I02 | src/features/inspection-capability/InspectionCapabilityPage.tsx (standards 新建/编辑) | POST /api/inspection-standards ; PUT /api/inspection-standards/:id | inspection_standard | M06.F04.I02 | – | 已上线 |
| M06.F04.I09 | src/features/inspection-capability/InspectionCapabilityPage.tsx (standards 删除) | DELETE /api/inspection-standards/:id | inspection_standard | M06.F04.I09 | – | 规划 |
| M06.F04.I04 | src/features/inspection-capability/AssociationManager.tsx (standard↔parameter) | POST /api/inspection-standard-parameters ; DELETE 同 | inspection_standard_parameter | M06.F04.I04 | – | 已上线 |
| M06.F04.I05 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 objects 页签 unlink) | DELETE /api/report-names/links/object | inspection_object_report_name | M06.F04.I05 | – | 已上线 |
| M06.F04.I06 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 parameters 页签 unlink) | DELETE /api/report-names/links/parameter | inspection_report_name_parameter | M06.F04.I06 | – | 已上线 |
| M06.F04.I07 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 standards 页签 unlink，role=TESTING/JUDGMENT) | DELETE /api/report-names/links/standard | inspection_report_name_standard | M06.F04.I07 | – | 已上线 |
| M06.F05.I01 | src/features/inspection-capability/CalculationRuleList.tsx | GET /api/inspection-calculation-rules | inspection_calculation_rule | M06.F05.I01 | – | 已上线 |
| M06.F05.I02 | src/features/inspection-capability/TwoLevelObjectStandardTree.tsx (行内新建/编辑) | POST /api/inspection-calculation-rules ; PUT 同/:id | inspection_calculation_rule | M06.F05.I02 | – | 已上线 |
| M06.F05.I04 | src/features/inspection-capability/CalculationMethodList.tsx (行内编辑，树由 TwoLevelObjectStandardTree 提供) | PUT /api/calculation-methods/:objectCode/:parameterCode | inspection_calculation_rule | M06.F05.I04 | – | 已上线 |
| M06.F05.I05 | src/features/inspection-capability/CalculationMethodList.tsx (行内删除) | DELETE /api/calculation-methods/:objectCode/:parameterCode | inspection_calculation_rule | M06.F05.I05 | – | 已上线 |
| M06.F06.I01 | src/features/inspection-capability/TechnicalRequirementList.tsx | GET /api/inspection-technical-requirements | inspection_technical_requirement | M06.F06.I01 | – | 已上线 |
| M06.F06.I02 | src/features/inspection-capability/TwoLevelObjectStandardTree.tsx (行内新建/编辑) | POST /api/inspection-technical-requirements ; PUT 同/:id | inspection_technical_requirement | M06.F06.I02 | – | 已上线 |
| M06.F06.I04 | src/features/inspection-capability/TechnicalRequirementList.tsx (行内编辑，树由 TwoLevelObjectStandardTree 提供) | PUT /api/technical-requirements/:object/:param/:standard | inspection_technical_requirement | M06.F06.I04 | – | 已上线 |
| M06.F06.I05 | src/features/inspection-capability/TechnicalRequirementList.tsx (行内删除) | DELETE /api/technical-requirements/:object/:param/:standard | inspection_technical_requirement | M06.F06.I05 | – | 已上线 |
| M06.F07.I01 | src/features/inspection-capability/ReportNameList.tsx | GET /api/inspection-report-names | inspection_report_name | M06.F07.I01 | – | 已上线 |
| M06.F07.I02 | src/features/inspection-capability/ReportNameList.tsx (新建/编辑) | POST /api/inspection-report-names ; PUT 同/:id | inspection_report_name | M06.F07.I02 | – | 已上线 |
| M06.F07.I09 | src/features/inspection-capability/ReportNameList.tsx (行内删除) | DELETE /api/inspection-report-names/:id | inspection_report_name | M06.F07.I09 | – | 规划 |
| M06.F07.I04 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 objects 页签) | POST /api/inspection-report-names/links/object ; DELETE 同 | inspection_object_report_name | M06.F07.I04 | – | 已上线 |
| M06.F07.I05 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 standards 页签 role=TESTING) | POST /api/inspection-report-names/links/standard ; DELETE 同 | inspection_report_name_standard | M06.F07.I05 | – | 已上线 |
| M06.F07.I06 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 standards 页签 role=JUDGMENT) | POST /api/inspection-report-names/links/standard ; DELETE 同 | inspection_report_name_standard | M06.F07.I06 | – | 已上线 |
| M06.F07.I07 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 parameters 页签) | POST /api/inspection-report-names/links/parameter ; DELETE 同 | inspection_report_name_parameter | M06.F07.I07 | – | 已上线 |
| M06.F07.I08 | src/features/inspection-capability/ReportNameList.tsx (extFields 编辑器) | PATCH /api/inspection-report-names/:id (extFields JSON) | inspection_report_name | M06.F07.I08 | – | 已上线 |
| M06.F08.I01 | src/features/inspection-capability/ParamInterfaceList.tsx | GET /api/param-interfaces | inspection_param_interface | M06.F08.I01 | – | 已上线 |
| M06.F08.I02 | src/features/inspection-capability/ParamInterfaceList.tsx (新建/编辑) | POST /api/param-interfaces ; PUT 同/:id | inspection_param_interface | M06.F08.I02 | – | 已上线 |
| M06.F08.I07 | src/features/inspection-capability/ParamInterfaceList.tsx (行内删除) | DELETE /api/param-interfaces/:id | inspection_param_interface | M06.F08.I07 | – | 规划 |
| M06.F08.I04 | src/features/inspection-capability/ParamInterfaceList.tsx (关联参数页签) | POST /api/inspection-parameter-param-interfaces ; DELETE 同 | inspection_parameter_param_interface | M06.F08.I04 | – | 已上线 |
| M06.F08.I05 | src/features/inspection-capability/ParamInterfacePreviewModal.tsx (列表行预览按钮) | – (本地渲染) | inspection_param_interface | M06.F08.I05 | – | 已上线 |
| M06.F08.I06 | src/features/inspection-capability/ParamInterfacePreviewModal.tsx (弹窗) | – (本地渲染) | inspection_param_interface | M06.F08.I06 | – | 已上线 |
| M05.F01.I01 | src/features/summary/SummaryPage.tsx | GET /api/summary?categoryCode= ; GET /api/report-names (下拉) | sample_receipts | M05.F01.I01 | – | 已上线 |
| M04.F06.I01 | src/features/dicts/CategoryDictList.tsx (endpoint=models) | GET /api/catalog/models?inspectionObjectCode= | inspection_models | M04.F06.I01 | – | 已上线 |
| M04.F06.I02 | src/features/dicts/CategoryDictList.tsx (新建/编辑弹窗) | POST /api/catalog/models ; PUT /api/catalog/models/:code | inspection_models | M04.F06.I02 | – | 已上线 |
| M04.F06.I04 | src/features/dicts/CategoryDictList.tsx (删除确认) | DELETE /api/catalog/models/:code | inspection_models | M04.F06.I04 | – | 已上线 |
| M04.F07.I01 | src/features/dicts/CategoryDictList.tsx (endpoint=specs) | GET /api/catalog/specs?inspectionObjectCode= | inspection_specs | M04.F07.I01 | – | 已上线 |
| M04.F07.I02 | src/features/dicts/CategoryDictList.tsx (新建/编辑弹窗) | POST /api/catalog/specs ; PUT /api/catalog/specs/:code | inspection_specs | M04.F07.I02 | – | 已上线 |
| M04.F07.I04 | src/features/dicts/CategoryDictList.tsx (删除确认) | DELETE /api/catalog/specs/:code | inspection_specs | M04.F07.I04 | – | 已上线 |
| M04.F08.I01 | src/features/dicts/CategoryDictList.tsx (endpoint=grades) | GET /api/catalog/grades?inspectionObjectCode= | inspection_grades | M04.F08.I01 | – | 已上线 |
| M04.F08.I02 | src/features/dicts/CategoryDictList.tsx (新建/编辑弹窗) | POST /api/catalog/grades ; PUT /api/catalog/grades/:code | inspection_grades | M04.F08.I02 | – | 已上线 |
| M04.F08.I04 | src/features/dicts/CategoryDictList.tsx (删除确认) | DELETE /api/catalog/grades/:code | inspection_grades | M04.F08.I04 | – | 已上线 |
| M04.F09.I01 | src/features/dicts/CategoryDictList.tsx (endpoint=brands) | GET /api/catalog/brands?inspectionObjectCode= | inspection_brands | M04.F09.I01 | – | 已上线 |
| M04.F09.I02 | src/features/dicts/CategoryDictList.tsx (新建/编辑弹窗) | POST /api/catalog/brands ; PUT /api/catalog/brands/:code | inspection_brands | M04.F09.I02 | – | 已上线 |
| M04.F09.I04 | src/features/dicts/CategoryDictList.tsx (删除确认) | DELETE /api/catalog/brands/:code | inspection_brands | M04.F09.I04 | – | 已上线 |
| M01.F04.I02 | src/app/(console)/layout.tsx (guard main) | router.replace('/login') | – | M01.F04.I02 | – | 已上线 |
| M01.F04.I04 | src/components/app/sidebar-nav.tsx (useBackendMenus) + src/app/api/auth/menus/route.ts + src/lib/auth/menu-snapshot.ts | GET /api/auth/menus（ADR-0009：saas 快照缓存 → demo 兜底） | – | M01.F04.I04 | – | 已上线 |
| M01.F04.I01 | src/app/api/auth/menus/route.ts（@entry 锚点）+ src/lib/auth/menu-snapshot.ts（缓存读写） | GET /api/auth/menus | – | M01.F04.I01 | – | 已上线 |
| M05.F01.I02 | src/features/summary/SummaryPage.tsx（@entry 仪表盘容器，包裹 I03/I04/I05 三区块） | GET /api/summary/stats + GET /api/summary?categoryCode= | – | M05.F01.I02 | – | 已上线 |
| M05.F01.I03 | src/features/summary/SummaryPage.tsx（@entry 核心指标卡 section）+ src/app/api/summary/stats/route.ts（todayTestCount/qualifiedRateByMaterial/reportOutputByStatus 字段） | GET /api/summary/stats | sample_receipts | M05.F01.I03 | – | 已上线 |
| M05.F01.I04 | src/features/summary/SummaryPage.tsx（@entry 任务漏斗 section）+ src/app/api/summary/stats/route.ts（funnelByStage:{pending_collect,received,testing,reporting,reviewing,issued}） | GET /api/summary/stats | sample_receipts | M05.F01.I04 | – | 已上线 |

| M01.F05.I01 | src/components/app/login-form.tsx (submit Button) | POST /api/auth/login | – | M01.F05.I01 | – | 已上线 |
| M01.F05.I02 | src/api/legacy-client.ts (request interceptor) | Authorization: Bearer &lt;token&gt; | – | M01.F05.I02 | – | 已上线 |
| M01.F05.I03 | src/app/login/page.tsx (SSO orchestrator div) | GET /api/auth/sso/authorize ; POST /api/auth/sso/callback | – | M01.F05.I03 | – | 已上线 |
| M01.F05.I04 | src/state/authStore.ts (acceptSsoSession) | GET /api/auth/permissions | – | M01.F05.I04 | – | 已上线 |
| M01.F05.I05 | src/components/app/app-shell.tsx (logout Button) | POST /api/auth/logout | – | M01.F05.I05 | – | 已上线 |

## 约定

1. **权限码 = 功能子项 ID。** 前端按钮的权限判断直接写 ID。
2. 一个接口服务多个子项时，多行重复写。不要为表好看而合并 —— 合并后看不清接口还有没有别的调用方。
3. 状态列必须与功能清单一致。不一致以功能清单为准。

## 评审时问这三个问题

1. 有没有子项没有权限码？→ 那它就是任何人都能点的按钮
2. 有没有一张表被三个以上模块直接写入？→ 边界破了
3. 「开发中」的行里接口和表填了吗？→ 没填就是还在纸上，别报进度