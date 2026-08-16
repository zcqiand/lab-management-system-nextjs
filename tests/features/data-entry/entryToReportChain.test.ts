import { describe, expect, beforeEach } from "vitest";
import { fnTest } from "../../fn";
import { seedData, tablesOf } from "../../helpers/seed";
const { receiptTable, sampleTable, testRecordTable, orgInfoTable } = tablesOf();
import {
  assembleReport,
  flattenForDocx,
} from "@/features/data-entry/reportTemplateData";
import { resolveInterfaceByParam } from "@/features/data-entry/models/resolveInterfaceByParam";
import { MODEL_REGISTRY } from "@/features/data-entry/models/registry";
import reportNames from "@/data/generated/inspection-report-name.json";
import rnParams from "@/data/generated/inspection-report-name-parameter.json";
import inspectionParamInterfaces from "@/data/generated/inspection-param-interface.json";
import inspectionParamInterfaceLinks from "@/data/generated/inspection-parameter-param-interface.json";
import type { SampleReceipt, Sample, TestRecord } from "@/types/api";
import type { OrgInfo } from "@/types/api";
import type { ParamInterfaceRow, ParamInterfaceLink } from "@/types/common";

/**
 * 录入 → 报告 链路回归。
 *
 * 这些用例锁的是「数据录入界面产出的形状」与「报告模板 manifest 取数路径」必须对齐——
 * 历史上断在三处：参数界面关联指向了 componentPath 而非 code、录入卡不落库派生列、
 * 模板 manifest 没登记数据格。任何一处回退，下面的断言都会失败。
 */

const RN = reportNames as Array<{ code: string; templatePath: string }>;
const TEMPLATE_BY_RN = new Map(RN.map((r) => [r.code, r.templatePath.replace(/\.docx$/, "")]));

function contextFor(categoryCode: string): {
  receipt: SampleReceipt;
  samples: Sample[];
  records: TestRecord[];
} {
  const receipt = receiptTable
    .all()
    .find((r) => r.categoryCode === categoryCode) as SampleReceipt | undefined;
  if (!receipt) throw new Error(`未找到 ${categoryCode} 的接样单种子`);
  const samples = sampleTable.all().filter((s) => s.receiptId === receipt.id) as unknown as Sample[];
  const sampleIds = new Set(samples.map((s) => s.id));
  const records = testRecordTable
    .all()
    .filter((r) => sampleIds.has(r.sampleId as string)) as unknown as TestRecord[];
  return { receipt, samples, records };
}

function flatFor(categoryCode: string): Record<string, unknown> {
  const ctx = contextFor(categoryCode);
  const org = orgInfoTable.all()[0] as unknown as OrgInfo | null ?? null;
  const structured = assembleReport({ ...ctx, org });
  return flattenForDocx(
    categoryCode,
    TEMPLATE_BY_RN.get(categoryCode) ?? null,
    structured,
    ctx.samples,
    ctx.records,
  );
}

/** manifest 空值兜底是 '—'；用它判断某个 tag 是否真的取到了值。 */
function filled(flat: Record<string, unknown>, tag: string): boolean {
  const v = flat[tag];
  return typeof v === "string" && v.trim() !== "" && v !== "—";
}

describe("录入卡 → 报告模板 取数链路", () => {
  beforeEach(() => {
    seedData();
  });

  fnTest(
    ["M06.F08.I04"],
    "参数界面关联的 inspectionParamInterfaceCode 全部存在于 inspection-param-interface.json",
    () => {
      const codes = new Set((inspectionParamInterfaces as ParamInterfaceRow[]).map((p) => p.code));
      const dangling = (inspectionParamInterfaceLinks as ParamInterfaceLink[]).filter(
        (l) => !codes.has(l.inspectionParamInterfaceCode),
      );
      // 历史 bug：4 条关联把 componentPath('rebar-mech-numeric') 当成了 code，
      // resolveInterfaceByParam 会静默丢弃 → 录入页悄悄回退默认四格卡。
      expect(dangling).toEqual([]);
    },
  );

  fnTest(["M06.F08.I04"], "每个界面的 componentPath 都能在 MODEL_REGISTRY 解析到组件", () => {
    const missing = (inspectionParamInterfaces as ParamInterfaceRow[])
      .map((p) => p.componentPath)
      .filter((cp) => !(cp in MODEL_REGISTRY));
    expect(missing).toEqual([]);
  });

  fnTest(["M03.F03.I03"], "每个报告名称都关联了至少一个检测参数", () => {
    const linked = new Set(
      (rnParams as Array<{ reportNameCode: string }>).map((l) => l.reportNameCode),
    );
    // 关联为空时 seedReceipt 的 testParameters 会是 undefined，
    // 数据录入弹窗会把全部 577 个参数铺开。
    const empty = RN.map((r) => r.code).filter((c) => !linked.has(c));
    expect(empty).toEqual([]);
  });

  fnTest(["M03.F03.I03", "M06.F08.I04"], "颗粒级配落库形状带累计筛余与细度模数", () => {
    // 砂：4 行 × 6 筛孔 + 细度模数；碎（卵）石：1 行 × 12 筛孔
    for (const rn of ["RN-103-1", "RN-103-2", "RN-103-3", "RN-103-4"]) {
      const flat = flatFor(rn);
      // 模板取 record:IP-0577:rows[i].cumulativePct[j] / rows[i].finenessModulus
      // 砂用 kljp<行>_<列>，碎（卵）石用 kljp_jcz<列>——两种命名都要覆盖
      const gradationTags = Object.keys(flat).filter((k) => k.startsWith("kljp"));
      expect(gradationTags.length, `${rn} 无级配 tag`).toBeGreaterThan(0);
      const empty = gradationTags.filter((t) => !filled(flat, t));
      expect(empty, `${rn} 级配空格`).toEqual([]);
    }
  });

  fnTest(["M03.F03.I03", "M06.F08.I04"], "抗渗报告三个样品块分别取到各自样品的数据", () => {
    const flat = flatFor("RN-105-2");
    for (const p of ["s1", "s2", "s3"]) {
      expect(filled(flat, `${p}_bh`)).toBe(true);
      expect(filled(flat, `${p}_syl0`)).toBe(true);
      expect(filled(flat, `${p}_sqk0`)).toBe(true);
      expect(filled(flat, `${p}_jd`)).toBe(true);
    }
    // 三块必须是不同样品，不能都渲染首样品
    expect(new Set([flat.s1_bh, flat.s2_bh, flat.s3_bh]).size).toBe(3);
  });

  fnTest(["M03.F03.I03", "M06.F08.I04"], "土工击实报告取到 5 组数据与峰值", () => {
    const flat = flatFor("RN-109-1");
    for (const col of [1, 2, 4, 6, 7]) {
      expect(filled(flat, `d${col}`)).toBe(true);
      expect(filled(flat, `w${col}`)).toBe(true);
    }
    expect(filled(flat, "maxd")).toBe(true);
    expect(filled(flat, "bestw")).toBe(true);
  });

  fnTest(["M03.F03.I03", "M06.F08.I04"], "压实度报告逐行取到干密度/压实度/评定", () => {
    for (const rn of ["RN-109-2", "RN-109-3"]) {
      const flat = flatFor(rn);
      for (let r = 1; r <= 6; r++) {
        expect(filled(flat, `s${r}_gmd`)).toBe(true);
        expect(filled(flat, `s${r}_ysd`)).toBe(true);
        expect(filled(flat, `s${r}_pd`)).toBe(true);
      }
    }
  });

  fnTest(["M03.F03.I03"], "砂浆抗压强度走试件轴且强度列 kyqd 有值", () => {
    const ctx = contextFor("RN-108-2");
    const org = orgInfoTable.all()[0] as unknown as OrgInfo | null ?? null;
    const structured = assembleReport({ ...ctx, org });
    expect("rows" in structured).toBe(true);
    const rows = (structured as { rows: Array<{ kyqd: string; dbz: string }> }).rows;
    // 108 模板 {#rows} 循环用单列 {kyqd}（105 才是 kyqd0/1/2）
    expect(rows[0]!.kyqd).not.toBe("");
    expect(rows[0]!.dbz).not.toBe("");
  });

  fnTest(["M06.F08.I04"], "模板 record:/srecord: 引用的参数都绑定了非默认录入卡", () => {
    const interfaces = inspectionParamInterfaces as ParamInterfaceRow[];
    const links = inspectionParamInterfaceLinks as ParamInterfaceLink[];
    // 结构化取数（record:/srecord:）只有在参数绑了会输出 JSON 的卡时才成立；
    // 回退到 DefaultParamCard 就是纯文本，模板路径必然取空。
    const cases: Array<[string, string]> = [
      ["RN-103-1", "IP-0577"],
      ["RN-103-2", "IP-0577"],
      ["RN-103-3", "IP-0577"],
      ["RN-103-4", "IP-0577"],
      ["RN-105-2", "IP-0190"],
      ["RN-109-1", "IP-0226"],
      ["RN-109-2", "IP-0456"],
      ["RN-109-3", "IP-0456"],
      ["RN-102-3", "IP-0087"],
      ["RN-102-2", "IP-0087"],
    ];
    for (const [rn, param] of cases) {
      const map = resolveInterfaceByParam(interfaces, links, rn);
      expect(map[param], `${rn} / ${param} 未绑定参数界面`).toBeDefined();
      expect(map[param]!.componentPath).not.toBe("default");
    }
  });
});
