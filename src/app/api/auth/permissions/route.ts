// GET /api/auth/permissions → {permissions}（demo 全量权限，msw authExtraHandlers 同款）

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    permissions: [
      "contract:read",
      "contract:write",
      "sample:read",
      "sample:write",
      "report:read",
      "report:write",
      "report:issue",
      "inspection:read",
      "inspection:write",
      "audit:read",
      "*",
    ],
  });
}
