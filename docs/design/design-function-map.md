# 设计与功能对齐 — 实验室管理系统-Next.js

> 人填、人评审。机器只检查功能 ID 存在性。
> 回答一个问题：**这个功能子项，落到哪段代码、哪张表、哪个权限码上？**
> 答不上来的行，说明设计没做完，别开工。

## 映射表

| 功能子项 ID | 页面/组件 | 接口 | 数据表 | 权限码 | 设计稿 | 状态 |
|---|---|---|---|---|---|---|
| M02.F01.I01 | src/app/contracts/page.tsx | GET /api/contracts | contracts | M02.F01.I01 | – | 已上线 |
| M02.F01.I02 | src/app/contracts/page.tsx (Dialog) | POST /api/contracts ; PUT /api/contracts/:id | contracts | M02.F01.I02 | – | 已上线 |
| M02.F01.I03 | src/app/contracts/page.tsx (行内删除) | DELETE /api/contracts/:id | contracts | M02.F01.I03 | – | 已上线 |
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
| M03.F03.I04 | src/features/data-entry/* (行内删除) | DELETE /api/test-records/:id | test_records | M03.F03.I04 | – | 已上线 |
| M03.F03.I06 | src/features/data-entry/* (verdict 改判) | PATCH /api/test-records/:id (verdict) | test_records | M03.F03.I06 | – | 已上线 |
| M03.F03.I07 | src/app/data-entry/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F03.I07 | – | 已上线 |
| M03.F03.I08 | src/app/api/test-records/route.ts (GET) | GET /api/test-records?sampleId=&receiptId= | test_records | M03.F03.I08 | – | 已上线 |
| M03.F03.I09 | src/app/api/test-records/route.ts (POST) | POST /api/test-records | test_records | M03.F03.I09 | – | 已上线 |
| M03.F05.I01 | src/app/report-review/page.tsx | GET /api/sample-receipts?stage=review | sample_receipts | M03.F05.I01 | – | 已上线 |
| M03.F05.I02 | src/app/report-review/page.tsx (查看报告) | GET /api/sample-receipts/:id?with=report | sample_receipts | M03.F05.I02 | – | 已上线 |
| M03.F05.I03 | src/features/reports/* (审核通过/驳回) | PATCH /api/sample-receipts/:id (flowStatus) | sample_receipts + audit_events | M03.F05.I03 | – | 已上线 |
| M03.F05.I04 | src/app/report-review/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F05.I04 | – | 已上线 |
| M03.F06.I01 | src/app/report-approve/page.tsx | GET /api/sample-receipts?stage=approve | sample_receipts | M03.F06.I01 | – | 已上线 |
| M03.F06.I02 | src/app/report-approve/page.tsx (查看报告) | GET /api/sample-receipts/:id?with=report | sample_receipts | M03.F06.I02 | – | 已上线 |
| M03.F06.I03 | src/features/reports/* (批准通过/驳回) | PATCH /api/sample-receipts/:id (flowStatus) | sample_receipts + audit_events | M03.F06.I03 | – | 已上线 |
| M03.F06.I04 | src/app/report-approve/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F06.I04 | – | 已上线 |
| M03.F07.I01 | src/app/report-issue/page.tsx | GET /api/sample-receipts?stage=issue | sample_receipts | M03.F07.I01 | – | 已上线 |
| M03.F07.I02 | src/app/report-issue/page.tsx (查看报告) | GET /api/sample-receipts/:id?with=report | sample_receipts | M03.F07.I02 | – | 已上线 |
| M03.F07.I03 | src/features/reports/* (报告发放) | PATCH /api/sample-receipts/:id (flowStatus=issued) | sample_receipts + audit_events | M03.F07.I03 | – | 已上线 |
| M03.F07.I04 | src/app/report-issue/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F07.I04 | – | 已上线 |
| M03.F08.I01 | src/app/report-archive/page.tsx | GET /api/sample-receipts?stage=archive | sample_receipts | M03.F08.I01 | – | 已上线 |
| M03.F08.I02 | src/app/report-archive/page.tsx (查看报告) | GET /api/sample-receipts/:id?with=report | sample_receipts | M03.F08.I02 | – | 已上线 |
| M03.F08.I03 | src/features/reports/* (报告归档) | PATCH /api/sample-receipts/:id (flowStatus=archived) | sample_receipts + audit_events | M03.F08.I03 | – | 已上线 |
| M03.F08.I04 | src/app/report-archive/page.tsx (FilterBar) | GET /api/sample-receipts?flowStatus= | sample_receipts | M03.F08.I04 | – | 已上线 |
| M03.F09.I01 | src/features/flow-pipeline/FlowStagePage.tsx (行内查看按钮) | – (路由跳转) | sample_receipts | M03.F09.I01 | – | 已上线 |
| M03.F09.I02 | src/app/receipts/[id]/page.tsx | GET /api/sample-receipts/:id?samples&records&report | sample_receipts + samples + test_records | M03.F09.I02 | – | 已上线 |
| M03.F09.I03 | src/app/receipts/[id]/page.tsx (报告预览按钮) | – (复用 ReportPreviewModal) | sample_receipts | M03.F09.I03 | – | 已上线 |
| M06.F01.I01 | src/features/inspection-capability/InspectionCapabilityPage.tsx (specialties) | GET /api/inspection-specialties | inspection_specialty | M06.F01.I01 | – | 已上线 |
| M06.F01.I02 | src/features/inspection-capability/InspectionCapabilityPage.tsx (specialties 新建/编辑) | POST /api/inspection-specialties ; PUT /api/inspection-specialties/:id | inspection_specialty | M06.F01.I02 | – | 已上线 |
| M06.F01.I03 | src/features/inspection-capability/InspectionCapabilityPage.tsx (specialties 删除) | DELETE /api/inspection-specialties/:id | inspection_specialty | M06.F01.I03 | – | 已上线 |
| M06.F02.I01 | src/features/inspection-capability/InspectionCapabilityPage.tsx (objects) | GET /api/inspection-objects | inspection_object | M06.F02.I01 | – | 已上线 |
| M06.F02.I02 | src/features/inspection-capability/InspectionCapabilityPage.tsx (objects 新建/编辑) | POST /api/inspection-objects ; PUT /api/inspection-objects/:id | inspection_object | M06.F02.I02 | – | 已上线 |
| M06.F02.I03 | src/features/inspection-capability/InspectionCapabilityPage.tsx (objects 删除) | DELETE /api/inspection-objects/:id | inspection_object | M06.F02.I03 | – | 已上线 |
| M06.F02.I04 | src/features/inspection-capability/AssociationManager.tsx (role=TESTING) | POST /api/inspection-object-standards ; DELETE 同 | inspection_object_standard | M06.F02.I04 | – | 已上线 |
| M06.F02.I05 | src/features/inspection-capability/AssociationManager.tsx (role=JUDGMENT) | POST /api/inspection-object-standards ; DELETE 同 | inspection_object_standard | M06.F02.I05 | – | 已上线 |
| M06.F02.I06 | src/features/inspection-capability/AssociationManager.tsx (object↔parameter) | POST /api/inspection-object-parameters ; DELETE 同 | inspection_object_parameter | M06.F02.I06 | – | 已上线 |
| M06.F02.I07 | src/features/inspection-capability/InspectionCapabilityFormModal.tsx (specialty↔object) | POST /api/inspection-specialty-objects ; DELETE 同 | inspection_specialty_object | M06.F02.I07 | – | 已上线 |
| M06.F03.I01 | src/features/inspection-capability/InspectionCapabilityPage.tsx (parameters) | GET /api/inspection-parameters | inspection_parameter | M06.F03.I01 | – | 已上线 |
| M06.F03.I02 | src/features/inspection-capability/InspectionCapabilityPage.tsx (parameters 新建/编辑) | POST /api/inspection-parameters ; PUT /api/inspection-parameters/:id | inspection_parameter | M06.F03.I02 | – | 已上线 |
| M06.F03.I03 | src/features/inspection-capability/InspectionCapabilityPage.tsx (parameters 删除) | DELETE /api/inspection-parameters/:id | inspection_parameter | M06.F03.I03 | – | 已上线 |
| M06.F04.I01 | src/features/inspection-capability/InspectionCapabilityPage.tsx (standards) | GET /api/inspection-standards | inspection_standard | M06.F04.I01 | – | 已上线 |
| M06.F04.I02 | src/features/inspection-capability/InspectionCapabilityPage.tsx (standards 新建/编辑) | POST /api/inspection-standards ; PUT /api/inspection-standards/:id | inspection_standard | M06.F04.I02 | – | 已上线 |
| M06.F04.I03 | src/features/inspection-capability/InspectionCapabilityPage.tsx (standards 删除) | DELETE /api/inspection-standards/:id | inspection_standard | M06.F04.I03 | – | 已上线 |
| M06.F04.I04 | src/features/inspection-capability/AssociationManager.tsx (standard↔parameter) | POST /api/inspection-standard-parameters ; DELETE 同 | inspection_standard_parameter | M06.F04.I04 | – | 已上线 |
| M06.F05.I01 | src/features/inspection-capability/CalculationRuleList.tsx | GET /api/inspection-calculation-rules | inspection_calculation_rule | M06.F05.I01 | – | 已上线 |
| M06.F05.I02 | src/features/inspection-capability/TwoLevelObjectStandardTree.tsx (行内新建/编辑) | POST /api/inspection-calculation-rules ; PUT 同/:id | inspection_calculation_rule | M06.F05.I02 | – | 已上线 |
| M06.F05.I03 | src/features/inspection-capability/TwoLevelObjectStandardTree.tsx (行内删除) | DELETE /api/inspection-calculation-rules/:id | inspection_calculation_rule | M06.F05.I03 | – | 已上线 |
| M06.F06.I01 | src/features/inspection-capability/TechnicalRequirementList.tsx | GET /api/inspection-technical-requirements | inspection_technical_requirement | M06.F06.I01 | – | 已上线 |
| M06.F06.I02 | src/features/inspection-capability/TwoLevelObjectStandardTree.tsx (行内新建/编辑) | POST /api/inspection-technical-requirements ; PUT 同/:id | inspection_technical_requirement | M06.F06.I02 | – | 已上线 |
| M06.F06.I03 | src/features/inspection-capability/TwoLevelObjectStandardTree.tsx (行内删除) | DELETE /api/inspection-technical-requirements/:id | inspection_technical_requirement | M06.F06.I03 | – | 已上线 |
| M06.F07.I01 | src/features/inspection-capability/ReportNameList.tsx | GET /api/inspection-report-names | inspection_report_name | M06.F07.I01 | – | 已上线 |
| M06.F07.I02 | src/features/inspection-capability/ReportNameList.tsx (新建/编辑) | POST /api/inspection-report-names ; PUT 同/:id | inspection_report_name | M06.F07.I02 | – | 已上线 |
| M06.F07.I03 | src/features/inspection-capability/ReportNameList.tsx (行内删除) | DELETE /api/inspection-report-names/:id | inspection_report_name | M06.F07.I03 | – | 已上线 |
| M06.F07.I04 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 objects 页签) | POST /api/inspection-report-names/links/object ; DELETE 同 | inspection_object_report_name | M06.F07.I04 | – | 已上线 |
| M06.F07.I05 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 standards 页签 role=TESTING) | POST /api/inspection-report-names/links/standard ; DELETE 同 | inspection_report_name_standard | M06.F07.I05 | – | 已上线 |
| M06.F07.I06 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 standards 页签 role=JUDGMENT) | POST /api/inspection-report-names/links/standard ; DELETE 同 | inspection_report_name_standard | M06.F07.I06 | – | 已上线 |
| M06.F07.I07 | src/features/inspection-capability/ReportNameList.tsx (编辑弹窗 parameters 页签) | POST /api/inspection-report-names/links/parameter ; DELETE 同 | inspection_report_name_parameter | M06.F07.I07 | – | 已上线 |
| M06.F07.I08 | src/features/inspection-capability/ReportNameList.tsx (extFields 编辑器) | PATCH /api/inspection-report-names/:id (extFields JSON) | inspection_report_name | M06.F07.I08 | – | 已上线 |
| M06.F08.I01 | src/features/inspection-capability/ParamInterfaceList.tsx | GET /api/param-interfaces | inspection_param_interface | M06.F08.I01 | – | 已上线 |
| M06.F08.I02 | src/features/inspection-capability/ParamInterfaceList.tsx (新建/编辑) | POST /api/param-interfaces ; PUT 同/:id | inspection_param_interface | M06.F08.I02 | – | 已上线 |
| M06.F08.I03 | src/features/inspection-capability/ParamInterfaceList.tsx (行内删除) | DELETE /api/param-interfaces/:id | inspection_param_interface | M06.F08.I03 | – | 已上线 |
| M06.F08.I04 | src/features/inspection-capability/ParamInterfaceList.tsx (关联参数页签) | POST /api/inspection-parameter-param-interfaces ; DELETE 同 | inspection_parameter_param_interface | M06.F08.I04 | – | 已上线 |
| M06.F08.I05 | src/features/inspection-capability/ParamInterfacePreviewModal.tsx (列表行预览按钮) | – (本地渲染) | inspection_param_interface | M06.F08.I05 | – | 已上线 |
| M06.F08.I06 | src/features/inspection-capability/ParamInterfacePreviewModal.tsx (弹窗) | – (本地渲染) | inspection_param_interface | M06.F08.I06 | – | 已上线 |
| M98.F01.I01 | ~~src/components/app/backend-switcher.tsx~~ 已废弃（ADR-0014） | – (UI 下拉) | – | M98.F01.I01 | – | 已废弃 |
| M98.F01.I02 | ~~src/api/backend-config.ts hydrateBackendConfig/snapshotBackendConfig~~ 已废弃（ADR-0014） | – (localStorage[`lab.backend`]) | – | M98.F01.I02 | – | 已废弃 |
| M98.F02.I01 | src/api/http-client.ts (installHttpClient) | – (axios 拦截器) | – | M98.F02.I01 | – | 已上线 |
| M98.F03.I01 | src/app/api/auth/login/route.ts | POST /api/auth/login | – (mock token) | M98.F03.I01 | – | 已上线 |
| M98.F03.I02 | src/app/api/auth/me/route.ts | GET /api/auth/me | – | M98.F03.I02 | – | 已上线 |
| M98.F03.I03 | src/app/api/auth/logout/route.ts | POST /api/auth/logout | – | M98.F03.I03 | – | 已上线 |
| M98.F03.I04 | src/app/api/auth/refresh/route.ts | POST /api/auth/refresh | – | M98.F03.I04 | – | 已上线 |
| M98.F03.I05 | src/app/api/auth/switch-tenant/route.ts | POST /api/auth/switch-tenant | – | M98.F03.I05 | – | 已上线 |
| M05.F01.I01 | src/features/summary/SummaryPage.tsx | GET /api/summary?categoryCode= ; GET /api/report-names (下拉) | sample_receipts | M05.F01.I01 | – | 已上线 |
| M04.F06.I01 | src/features/dicts/CategoryDictList.tsx (endpoint=models) | GET /api/catalog/models?inspectionObjectCode= | inspection_models | M04.F06.I01 | – | 已上线 |
| M04.F06.I02 | src/features/dicts/CategoryDictList.tsx (新建/编辑弹窗) | POST /api/catalog/models ; PUT /api/catalog/models/:code | inspection_models | M04.F06.I02 | – | 已上线 |
| M04.F06.I03 | src/features/dicts/CategoryDictList.tsx (删除确认) | DELETE /api/catalog/models/:code | inspection_models | M04.F06.I03 | – | 已上线 |
| M04.F07.I01 | src/features/dicts/CategoryDictList.tsx (endpoint=specs) | GET /api/catalog/specs?inspectionObjectCode= | inspection_specs | M04.F07.I01 | – | 已上线 |
| M04.F07.I02 | src/features/dicts/CategoryDictList.tsx (新建/编辑弹窗) | POST /api/catalog/specs ; PUT /api/catalog/specs/:code | inspection_specs | M04.F07.I02 | – | 已上线 |
| M04.F07.I03 | src/features/dicts/CategoryDictList.tsx (删除确认) | DELETE /api/catalog/specs/:code | inspection_specs | M04.F07.I03 | – | 已上线 |
| M04.F08.I01 | src/features/dicts/CategoryDictList.tsx (endpoint=grades) | GET /api/catalog/grades?inspectionObjectCode= | inspection_grades | M04.F08.I01 | – | 已上线 |
| M04.F08.I02 | src/features/dicts/CategoryDictList.tsx (新建/编辑弹窗) | POST /api/catalog/grades ; PUT /api/catalog/grades/:code | inspection_grades | M04.F08.I02 | – | 已上线 |
| M04.F08.I03 | src/features/dicts/CategoryDictList.tsx (删除确认) | DELETE /api/catalog/grades/:code | inspection_grades | M04.F08.I03 | – | 已上线 |
| M04.F09.I01 | src/features/dicts/CategoryDictList.tsx (endpoint=brands) | GET /api/catalog/brands?inspectionObjectCode= | inspection_brands | M04.F09.I01 | – | 已上线 |
| M04.F09.I02 | src/features/dicts/CategoryDictList.tsx (新建/编辑弹窗) | POST /api/catalog/brands ; PUT /api/catalog/brands/:code | inspection_brands | M04.F09.I02 | – | 已上线 |
| M04.F09.I03 | src/features/dicts/CategoryDictList.tsx (删除确认) | DELETE /api/catalog/brands/:code | inspection_brands | M04.F09.I03 | – | 已上线 |
| M01.F04.I02 | src/app/(console)/layout.tsx (guard main) | router.replace('/login') | – | M01.F04.I02 | – | 已上线 |
| M01.F04.I04 | src/components/app/sidebar-nav.tsx (aside) | GET /api/auth/menus?appId=lab-management | – | M01.F04.I04 | – | 已上线 |
| M01.F05.I01 | src/components/app/login-form.tsx (submit Button) | POST /api/auth/login | – | M01.F05.I01 | – | 已上线 |
| M01.F05.I02 | src/api/legacy-client.ts (request interceptor) | Authorization: Bearer &lt;token&gt; | – | M01.F05.I02 | – | 已上线 |
| M01.F05.I03 | src/app/login/page.tsx (SSO orchestrator div) | GET /api/auth/sso/authorize ; POST /api/auth/sso/callback | – | M01.F05.I03 | – | 已上线 |
| M01.F05.I04 | src/state/authStore.ts (acceptSsoSession) | GET /api/auth/permissions | – | M01.F05.I04 | – | 已上线 |
| M01.F05.I05 | src/components/app/app-shell.tsx (logout Button) | POST /api/auth/logout | – | M01.F05.I05 | – | 已上线 |
| M97.F01.I01 | scripts/emit-schema.mjs (replay 段) | node scripts/emit-schema.mjs replay | – (lab_dev) | M97.F01.I01 | – | 已上线 (infra) |
| M97.F01.I02 | scripts/emit-schema.mjs (catalogDump / pg_dump 段) | node scripts/emit-schema.mjs dump | – (lab_dev) | M97.F01.I02 | – | 已上线 (infra) |
| M97.F01.I03 | scripts/emit-schema.mjs (drizzle-kit pull 段) + scripts/fix-pulled-schema.mjs | node scripts/emit-schema.mjs pull | – (lab_dev) | M97.F01.I03 | – | 已上线 (infra) |
| M97.F01.I04 | scripts/emit-schema.mjs (DBML 段) + scripts/v-sql-to-dbml.mjs | node scripts/emit-schema.mjs dbml | – (lab_dev) | M97.F01.I04 | – | 已上线 (infra) |
| M97.F02.I01 | package.json devDependencies (pg ^8.13.1) | – (借链给 sync-db) | – | M97.F02.I01 | – | 已上线 (infra) |
| M97.F02.I02 | scripts/borrow-pg.mjs (sanity) | node scripts/borrow-pg.mjs | lab_dev | M97.F02.I02 | – | 已上线 (infra) |
| M97.F02.I03 | ../lab-management-system-shared/scripts/sync-db.mjs:36-46 (createRequire borrow) | – (消费侧) | lab_dev | M97.F02.I03 | – | 已上线 (infra) |

## 约定

1. **权限码 = 功能子项 ID。** 前端按钮的权限判断直接写 ID。
2. 一个接口服务多个子项时，多行重复写。不要为表好看而合并 —— 合并后看不清接口还有没有别的调用方。
3. 状态列必须与功能清单一致。不一致以功能清单为准。

## 评审时问这三个问题

1. 有没有子项没有权限码？→ 那它就是任何人都能点的按钮
2. 有没有一张表被三个以上模块直接写入？→ 边界破了
3. 「开发中」的行里接口和表填了吗？→ 没填就是还在纸上，别报进度