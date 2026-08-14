import { describe, expect } from "vitest";
import type {
  AuthState,
  ContractState,
  ReceiptState,
  SampleState,
} from "@/types/store";
import { fnTest } from "../fn";

describe("types/store store 状态类型（v3）", () => {
  fnTest(["M01.F05.I01"], "AuthState 未登录态可构造", () => {
    const auth: AuthState = {
      user: null,
      token: null,
      status: "idle",
      error: null,
    };
    expect(auth.status).toBe("idle");
    expect(auth.user).toBeNull();
  });

  fnTest(["M01.F05.I01"], "AuthState 已登录态可构造", () => {
    const auth: AuthState = {
      user: {
        id: "u-001",
        username: "labadmin",
        displayName: "管理员",
        role: { id: "role-admin", name: "admin", permissions: [] },
        permissions: [],
      },
      token: "jwt-token",
      status: "authenticated",
      error: null,
    };
    expect(auth.status).toBe("authenticated");
    expect(auth.user?.username).toBe("labadmin");
  });

  fnTest(["M01.F03.I01"], "ContractState / ReceiptState / SampleState 结构一致", () => {
    const contracts: ContractState = {
      list: [],
      total: 0,
      current: null,
      loading: false,
      error: null,
    };
    const receipts: ReceiptState = {
      list: [],
      total: 0,
      current: null,
      loading: false,
      error: null,
    };
    const samples: SampleState = {
      list: [],
      total: 0,
      current: null,
      loading: false,
      error: null,
    };
    expect(contracts.total).toBe(0);
    expect(receipts.loading).toBe(false);
    expect(samples.current).toBeNull();
  });
});
