// 机构信息（M01.F01 报告头机构栏）——本地常量，非 API 域。
//
// 2026-09-17 SSOT 清理（用户裁定）：原私生端点 GET /api/org-info 已删除
// （shared tsp 无此路径；数据本身是静态 demo 单例，不构成动态接口需求）。
// 若未来机构信息需要动态化/多租户化，必须先进 shared tsp 契约再生成，
// 不允许恢复手写端点。

/** 机构信息形状（报告模板消费的 7 字段 + updatedAt 占位） */
export interface OrgInfo {
  orgName: string;
  registeredAddress: string;
  testingSiteAddress: string;
  postalCode: string;
  contactPhone: string;
  email: string;
  qualificationCertNo: string;
  updatedAt: string;
}

/** 单例数据（原 /api/org-info 路由的静态返回，逐字段搬移） */
export const ORG_INFO: OrgInfo = {
  orgName: "中国建筑检测中心",
  registeredAddress: "北京市海淀区中关村大街 1 号",
  testingSiteAddress: "北京市朝阳区望京西路 8 号",
  postalCode: "100080",
  contactPhone: "010-88880000",
  email: "lab@xx-test.cn",
  qualificationCertNo: "CMA L1234",
  updatedAt: "2026-09-17T00:00:00.000Z",
};
