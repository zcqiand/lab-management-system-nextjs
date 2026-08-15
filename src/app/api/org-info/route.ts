// GET /api/org-info → 机构信息（ReportPreviewModal 报告头机构栏）。
// lab-msw 无此端点（组件 catch 兜底 null）；本仓提供静态 demo 数据——
// REF shared lab-handlers orgInfoHandler 同款单行形状。

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    orgName: "中国建筑检测中心",
    registeredAddress: "北京市海淀区中关村大街 1 号",
    testingSiteAddress: "北京市朝阳区望京西路 8 号",
    postalCode: "100080",
    contactPhone: "010-88880000",
    email: "lab@xx-test.cn",
    qualificationCertNo: "CMA L1234",
  });
}
