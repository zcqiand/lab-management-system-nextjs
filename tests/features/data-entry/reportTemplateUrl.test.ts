import { describe, expect } from "vitest";
import { fnTest } from "../../fn";
import { pickTemplateUrl } from "@/features/data-entry/ReportPreviewModal";
import generatedReportNames from "@/data/generated/inspection-report-name.json";

describe("pickTemplateUrl（模板 URL 直构 public/templates）", () => {
  fnTest(["M03.F09.I03"], "有种子的 RN 码 → 返回 /templates/<文件名> 非空 URL", () => {
    const url = pickTemplateUrl("RN-101");
    expect(url).toBeTruthy();
    expect(url).toBe("/templates/101_%E6%B0%B4%E6%B3%A5%E6%A3%80%E6%B5%8B%E6%8A%A5%E5%91%8A.docx");
  });

  fnTest(
    ["M03.F09.I03"],
    "全部 30 个带 templatePath 的 RN → URL 指向 public/templates 下真实存在的文件名（encodeURIComponent 往返）",
    () => {
      const rows = (
        generatedReportNames as Array<{ code: string; templatePath?: string }>
      ).filter((r) => r.templatePath);
      expect(rows.length).toBe(30);
      for (const r of rows) {
        const url = pickTemplateUrl(r.code);
        expect(url).toBeTruthy();
        // URL 反解回来的文件名必须与种子 templatePath 一致（构 URL 无损）
        const fname = decodeURIComponent(url!.slice("/templates/".length));
        expect(fname).toBe(r.templatePath);
      }
    },
  );

  fnTest(["M03.F09.I03"], "无模板的类别码 → null（走「暂无报告模板」分支）", () => {
    expect(pickTemplateUrl("RN-404")).toBeNull();
    expect(pickTemplateUrl("")).toBeNull();
  });
});
