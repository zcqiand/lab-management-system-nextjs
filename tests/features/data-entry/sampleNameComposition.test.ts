import { describe, expect } from "vitest";
import { fnTest } from "../../fn";
import { applyComposedSampleName } from "@/features/data-entry/ReportPreviewModal";
import type { Sample } from "@/types/api";

describe("applyComposedSampleName（预览合成样品名称）", () => {
  fnTest(["M03.F09.I03"], "空数组：原样返回", () => {
    expect(applyComposedSampleName([])).toEqual([]);
  });

  fnTest(
    ["M03.F09.I03"],
    "sample 内建 model/grade 都有 → 合成 `model grade` 写入 sampleName",
    () => {
      const samples: Sample[] = [
        {
          id: "s1",
          receiptId: "r1",
          sampleCode: "RC-2024-0601-01-S1",
          sampleName: "建设用砂",
          model: "中砂",
          grade: "Ⅱ类",
          ext: {},
        } as Sample,
      ];
      const out = applyComposedSampleName(samples);
      expect(out[0]!.sampleName).toBe("中砂 Ⅱ类");
      // 原数组未改
      expect(samples[0]!.sampleName).toBe("建设用砂");
      // 不影响其它样品
      expect(out).toHaveLength(1);
    },
  );

  fnTest(
    ["M03.F09.I03"],
    "ext.sampleModel 优先于 sample.model（补录覆盖内建）",
    () => {
      const samples: Sample[] = [
        {
          id: "s1",
          receiptId: "r1",
          sampleCode: "S1",
          sampleName: "建设用砂",
          model: "中砂",
          grade: "Ⅱ类",
          ext: { sampleModel: "粗砂" },
        } as unknown as Sample,
      ];
      const out = applyComposedSampleName(samples);
      expect(out[0]!.sampleName).toBe("粗砂 Ⅱ类");
    },
  );

  fnTest(
    ["M03.F09.I03"],
    "model/grade/brand 都有 → 合成三者空格连接",
    () => {
      const samples: Sample[] = [
        {
          id: "s1",
          receiptId: "r1",
          sampleCode: "S1",
          model: "热轧带肋",
          grade: "HRB400",
          brand: "首钢",
          ext: {},
        } as unknown as Sample,
      ];
      const out = applyComposedSampleName(samples);
      expect(out[0]!.sampleName).toBe("热轧带肋 HRB400 首钢");
    },
  );

  fnTest(
    ["M03.F09.I03"],
    "model/grade/brand 全空 → 原 sampleName 不变（避免误覆盖用户输入）",
    () => {
      const samples: Sample[] = [
        {
          id: "s1",
          receiptId: "r1",
          sampleCode: "S1",
          sampleName: "建设用砂",
          ext: {},
        } as Sample,
      ];
      const out = applyComposedSampleName(samples);
      expect(out[0]!.sampleName).toBe("建设用砂");
    },
  );

  fnTest(
    ["M03.F09.I03"],
    "只填 grade → 合成只含 grade（model 空被 filter 掉）",
    () => {
      const samples: Sample[] = [
        {
          id: "s1",
          receiptId: "r1",
          sampleCode: "S1",
          sampleName: "建设用砂",
          grade: "Ⅱ类",
          ext: {},
        } as Sample,
      ];
      const out = applyComposedSampleName(samples);
      expect(out[0]!.sampleName).toBe("Ⅱ类");
    },
  );

  fnTest(
    ["M03.F09.I03"],
    "samples[1..] 不变（合成只对首个样品；其它样品保留 sampleName 原值）",
    () => {
      const samples: Sample[] = [
        {
          id: "s1",
          receiptId: "r1",
          sampleCode: "S1",
          model: "中砂",
          grade: "Ⅱ类",
          ext: {},
        } as Sample,
        {
          id: "s2",
          receiptId: "r1",
          sampleCode: "S2",
          sampleName: "样品2",
          ext: {},
        } as Sample,
      ];
      const out = applyComposedSampleName(samples);
      expect(out[0]!.sampleName).toBe("中砂 Ⅱ类");
      expect(out[1]!.sampleName).toBe("样品2");
    },
  );
});