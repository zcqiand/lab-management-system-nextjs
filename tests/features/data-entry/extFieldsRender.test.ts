import { describe, expect } from "vitest";
import { fnTest } from "../../fn";
import {
  assembleReport,
  flattenForDocx,
  resolveSourceByTag,
  ensureAllDocxTags,
} from "@/features/data-entry/reportTemplateData";
import type { SampleReceipt, Sample } from "@/types/api";

const receipt = (categoryCode: string): SampleReceipt =>
  ({
    id: "r1",
    contractId: "c1",
    commissionCode: "RC-1",
    categoryCode,
    receivedBy: "x",
    sampleSource: "施工送检",
    testCategory: "委托检验",
    flowStatus: "data_entry",
    flowHistory: [],
    lastSubmittedBy: null,
    createdAt: "",
    updatedAt: "",
  }) as unknown as SampleReceipt;

const sampleWithExt = (id: string, ext: Record<string, string>): Sample =>
  ({
    id,
    receiptId: "r1",
    sampleCode: "S1",
    sampleName: "样品",
    sampleQuantity: "1 组",
    remark: "",
    ext,
  }) as Sample;

describe("ext:<key> source 解析（M03.F01.I07 补录 → 预览）", () => {
  fnTest(
    ["M03.F01.I07"],
    "resolveSourceByTag：ext:qualityCertNo 取 samples[0].ext[qualityCertNo]",
    () => {
      const samples = [sampleWithExt("s1", { qualityCertNo: "ZB-2026-001" })];
      expect(
        resolveSourceByTag("ext:qualityCertNo", {
          samples,
          receipt: receipt("RN-102-1"),
          records: [],
          org: null,
        }),
      ).toBe("ZB-2026-001");
    },
  );

  fnTest(
    ["M03.F01.I07"],
    "resolveSourceByTag：ext: 命中但 sample 无 ext → 解析失败回退 —（不在此路径渲染）",
    () => {
      // resolveSourceByTag 仅返回解析结果；UI 兜底为 — 由调用方处理。
      const samples = [{ id: "s1", ext: {} } as unknown as Sample];
      expect(
        resolveSourceByTag("ext:missing", {
          samples,
          receipt: receipt("RN-102-1"),
          records: [],
          org: null,
        }),
      ).toBe("");
    },
  );

  fnTest(
    ["M03.F01.I07"],
    "RN-102-1 grid：manifest 含 ext:qualityCertNo 时走 ext 源而非 mock",
    () => {
      const samples = [sampleWithExt("s1", { qualityCertNo: "ZB-CUSTOM" })];
      const out = assembleReport({
        receipt: receipt("RN-102-1"),
        samples,
        records: [],
        org: null,
      });
      // 通过 tag alias 注入一个 ad-hoc cell（不走真实模板文件）。
      const flat = flattenForDocx(
        "RN-102-1",
        "102_钢筋力学性能、工艺性能、重量偏差检测报告",
        out,
        samples,
        [],
        {
          extraCells: [
            {
              table: 0,
              row: 0,
              col: 0,
              tag: "c_qualityCertNo",
              source: "ext:qualityCertNo",
            },
          ],
        },
      ) as Record<string, string>;
      expect(flat.c_qualityCertNo).toBe("ZB-CUSTOM");
    },
  );

  fnTest(
    ["M03.F01.I07"],
    "RN-102-1 grid：ext:qualityCertNo 未补录 → 打印 —，无残留 {tag}",
    () => {
      const samples = [sampleWithExt("s1", {})];
      const out = assembleReport({
        receipt: receipt("RN-102-1"),
        samples,
        records: [],
        org: null,
      });
      const flat = flattenForDocx(
        "RN-102-1",
        "102_钢筋力学性能、工艺性能、重量偏差检测报告",
        out,
        samples,
        [],
        {
          extraCells: [
            {
              table: 0,
              row: 0,
              col: 0,
              tag: "c_qualityCertNo",
              source: "ext:qualityCertNo",
            },
          ],
        },
      ) as Record<string, string>;
      expect(flat.c_qualityCertNo).toBe("—");
    },
  );

  fnTest(["M03.F01.I07"], "扁平化向后兼容：旧 5 条 source 前缀未变", () => {
    const samples = [sampleWithExt("s1", {})];
    const out = assembleReport({
      receipt: receipt("RN-101"),
      samples,
      records: [],
      org: null,
    });
    // 不传 extraCells，走原 manifest（旧 RN-101 应不受影响）
    const flat = flattenForDocx("RN-101", "101_水泥检测报告", out, samples) as Record<
      string,
      string
    >;
    expect(typeof flat.wtdw).toBe("string");
    expect(typeof flat.r9_jcz).toBe("string");
  });

  fnTest(
    ["M03.F09.I03"],
    "ensureAllDocxTags：docx 里出现的 {tag} 但 manifest 未登记 → 补成 —（不再打印 undefined）",
    () => {
      const flat: Record<string, unknown> = { r9_jcz: "5.33" };
      // 模拟 docx XML 含 3 个未登记 tag：p1_jcyj / c_yply / c_sccj
      const xml =
        "<w:p>{p1_jcyj} {c_yply} {c_sccj} {r9_jcz}</w:p>";
      const out = ensureAllDocxTags(flat, xml);
      expect(out.p1_jcyj).toBe("—");
      expect(out.c_yply).toBe("—");
      expect(out.c_sccj).toBe("—");
      expect(out.r9_jcz).toBe("5.33"); // 已存在的值不被覆盖
    },
  );

  fnTest(
    ["M03.F09.I03"],
    "ensureAllDocxTags：忽略 docxtemplater 控制标签 {#rows} / {/rows}",
    () => {
      const flat: Record<string, unknown> = {};
      const xml = "{#rows}{ybbh}{/rows}";
      const out = ensureAllDocxTags(flat, xml);
      // {#rows} 是循环起止符，不在 flat 中时不补 —，避免影响循环逻辑（实际由结构化对象处理）
      expect("rows" in out).toBe(false);
    },
  );
});
