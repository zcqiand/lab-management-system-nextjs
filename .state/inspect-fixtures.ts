import { contracts, sampleReceipts, samples, testRecords } from "@lab/management-system-msw/fixtures";
const pick = (arr: any[], keys: string[]) => arr.slice(0, 2).map((r) => Object.fromEntries(keys.filter((k) => k in r).map((k) => [k, (r as any)[k]])));
console.log("contracts:", contracts.length, JSON.stringify(pick(contracts, ["id", "tenantId", "contractCode"])));
console.log("receipts:", sampleReceipts.length, JSON.stringify(pick(sampleReceipts, ["id", "tenantId", "commissionCode", "contractId"])));
console.log("samples:", samples.length, JSON.stringify(pick(samples, ["id", "tenantId", "receiptId", "sampleCode"])));
console.log("testRecords:", testRecords.length, JSON.stringify(pick(testRecords, ["id", "tenantId", "sampleId"])));
console.log("receipt tenants:", [...new Set(sampleReceipts.map((r: any) => r.tenantId))]);
console.log("receipts with contractId:", sampleReceipts.filter((r: any) => r.contractId).length);
