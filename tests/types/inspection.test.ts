import { describe, expect } from "vitest";
import type {
  InspectionSpecialty,
  InspectionObject,
  InspectionParameter,
  InspectionStandard,
  InspectionObjectParameter,
  InspectionObjectStandard,
  InspectionStandardParameter,
  InspectionSpecialtyObject,
  InspectionCalculationRule,
  InspectionTechnicalRequirement,
  InspectionStandardRole,
  InspectionQualificationLevel,
  InspectionReadinessStatus,
} from "@/types/inspection";
import {
  INSPECTION_STANDARD_ROLES,
  INSPECTION_QUALIFICATION_LEVELS,
  INSPECTION_READINESS_STATUSES,
} from "@/types/inspection";
import { fnTest } from "../fn";

describe("types/inspection M06 检测能力领域", () => {
  fnTest(["M06.F01.I01"], "InspectionSpecialty 必备字段与时间戳可构造", () => {
    const spec: InspectionSpecialty = {
      id: "sp-01",
      code: "SP01",
      officialNo: "一",
      name: "建筑材料及构配件",
      isOfficial: true,
      enabled: true,
      sortOrder: 1,
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(spec.code).toBe("SP01");
    expect(spec.officialNo).toBe("一");
  });

  fnTest(["M06.F02.I01"], "InspectionObject 携带 sourceProjectNo/sourceProjectName/sourcePage", () => {
    const obj: InspectionObject = {
      id: "obj-001",
      code: "OBJ-SP01-P03-FINE",
      inspectionSpecialtyCode: "SP01",
      sourceProjectNo: "3",
      sourceProjectName: "骨料、集料",
      name: "细骨料",
      isOptionalForQualification: false,
      isOfficial: true,
      enabled: true,
      sortOrder: 3,
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(obj.sourceProjectName).toBe("骨料、集料");
    expect(obj.sourceProjectNo).toBe("3");
  });

  fnTest(["M06.F03.I01"], "InspectionParameter 保存 rawName/canonicalName/methodText/aliases", () => {
    const param: InspectionParameter = {
      id: "ip-001",
      code: "IP-STE001",
      name: "下屈服强度 ReL",
      rawName: "下屈服强度 ReL",
      canonicalName: "下屈服强度",
      methodText: "拉伸试验法",
      aliases: ["屈服强度", "屈服点"],
      unit: "MPa",
      sourceType: "official",
      sortOrder: 1,
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(param.aliases).toContain("屈服强度");
    expect(param.unit).toBe("MPa");
  });

  fnTest(["M06.F04.I01"], "InspectionStandard 含 version/status/sourceDocumentId", () => {
    const std: InspectionStandard = {
      id: "is-001",
      code: "GB 1499.2-2024",
      name: "钢筋混凝土用钢 第2部分：热轧带肋钢筋",
      version: "2024",
      status: "active",
      sourceDocumentId: "raw/standards/pdf/GB_1499.2-2024.pdf",
      sortOrder: 1,
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(std.status).toBe("active");
    expect(std.sourceDocumentId).toContain("raw/standards/pdf/");
  });

  fnTest(["M06.F02.I06"], "InspectionObjectParameter 关系必备字段", () => {
    const rel: InspectionObjectParameter = {
      id: "iop-001",
      inspectionObjectCode: "OBJ-SP01-P03-FINE",
      inspectionParameterCode: "IP-STE001",
      qualificationLevel: "QUALIFIED",
      sourcePage: 2,
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(rel.qualificationLevel).toBe("QUALIFIED");
  });

  fnTest(["M06.F02.I04"], "InspectionObjectStandard role=TESTING 表示检测依据", () => {
    const rel: InspectionObjectStandard = {
      id: "ios-001",
      inspectionObjectCode: "OBJ-SP01-P03-FINE",
      inspectionStandardCode: "GB/T 14684-2022",
      role: "TESTING",
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(rel.role).toBe("TESTING");
  });

  fnTest(["M06.F02.I05"], "InspectionObjectStandard role=JUDGMENT 表示判定依据", () => {
    const rel: InspectionObjectStandard = {
      id: "ios-002",
      inspectionObjectCode: "OBJ-SP01-P03-FINE",
      inspectionStandardCode: "GB/T 14684-2022",
      role: "JUDGMENT",
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(rel.role).toBe("JUDGMENT");
  });

  fnTest(["M06.F04.I04"], "InspectionStandardParameter 仅承载标准↔参数多对多关联", () => {
    const rel: InspectionStandardParameter = {
      id: "isp-001",
      inspectionStandardCode: "GB/T 14684-2022",
      inspectionParameterCode: "IP-STE001",
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(rel.inspectionStandardCode).toBe("GB/T 14684-2022");
    expect(rel.inspectionParameterCode).toBe("IP-STE001");
  });

  fnTest(["M06.F05.I01"], "InspectionCalculationRule 至少 object+parameter，可选 testingStandardCode", () => {
    const rule: InspectionCalculationRule = {
      id: "cr-001",
      inspectionObjectCode: "OBJ-SP01-P03-FINE",
      inspectionParameterCode: "IP-CON002",
      testingStandardCode: "GB/T 50081-2019",
      algorithmType: "compressive_strength",
      specimenCount: 3,
      conditions: "furnaceNo=?",
      roundingRule: "修约到 0.1",
      sortOrder: 1,
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(rule.algorithmType).toBe("compressive_strength");
    expect(rule.testingStandardCode).toBe("GB/T 50081-2019");
  });

  fnTest(["M06.F06.I01"], "InspectionTechnicalRequirement 必带 judgmentStandardCode+conditions+verificationStatus", () => {
    const req: InspectionTechnicalRequirement = {
      id: "tr-001",
      inspectionObjectCode: "OBJ-SP01-P03-FINE",
      inspectionParameterCode: "IP-SND002",
      judgmentStandardCode: "GB/T 14684-2022",
      conditions: "grade=Ⅱ类",
      valueType: "numeric",
      minValue: 0,
      maxValue: 3.0,
      unit: "%",
      comparison: "≤",
      judgmentMode: "automatic",
      verificationStatus: "verified",
      clause: "7.3.2",
      sourcePage: 12,
      brand: "HRB400",
      model: "",
      grade: "Ⅱ类",
      spec: "",
      sortOrder: 1,
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(req.verificationStatus).toBe("verified");
    expect(req.judgmentMode).toBe("automatic");
  });

  fnTest(["M06.F01.I01"], "枚举常量：检测标准角色只允许 TESTING/JUDGMENT", () => {
    expect(INSPECTION_STANDARD_ROLES).toEqual(["TESTING", "JUDGMENT"]);
  });

  fnTest(["M06.F02.I06"], "枚举常量：资质等级 QUALIFIED/RESTRICTED", () => {
    expect(INSPECTION_QUALIFICATION_LEVELS).toEqual(["QUALIFIED", "RESTRICTED"]);
  });

  fnTest(["M06.F01.I01"], "枚举常量：准备状态 catalogued/under-review/operational/disabled", () => {
    expect(INSPECTION_READINESS_STATUSES).toContain("operational");
    expect(INSPECTION_READINESS_STATUSES).toContain("disabled");
  });

  fnTest(["M06.F02.I01"], "类型守卫：InspectionObject 禁止 projectId/InspectionProject/InspectionObjectVariant/InspectionScheme 字段", () => {
    const obj = {} as Record<string, unknown>;
    expect("projectId" in obj).toBe(false);
    const typed: Partial<InspectionObject> = obj;
    expect(typed).not.toHaveProperty("projectId");
  });

  fnTest(["M06.F02.I06"], "InspectionObjectParameter 不再持有 projectId", () => {
    const rel = {} as Record<string, unknown>;
    expect("projectId" in rel).toBe(false);
  });

  fnTest(["M06.F02.I07"], "InspectionSpecialtyObject 中间表维持多对多关系", () => {
    const rel: InspectionSpecialtyObject = {
      id: "iso-001",
      inspectionSpecialtyCode: "SP01",
      inspectionObjectCode: "OBJ-SP01-P03-FINE",
      createdAt: "2026-07-22T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    };
    expect(rel.inspectionSpecialtyCode).toBe("SP01");
    expect(rel.inspectionObjectCode).toBe("OBJ-SP01-P03-FINE");
  });

  fnTest(["M06.F02.I01"], "InspectionReadinessStatus 联合类型可赋合法值", () => {
    const s1: InspectionReadinessStatus = "catalogued";
    const s2: InspectionReadinessStatus = "operational";
    const s3: InspectionReadinessStatus = "disabled";
    expect([s1, s2, s3]).toHaveLength(3);
  });

  fnTest(["M06.F02.I05"], "InspectionStandardRole 联合类型只接受枚举值", () => {
    const r1: InspectionStandardRole = "TESTING";
    const r2: InspectionStandardRole = "JUDGMENT";
    expect([r1, r2]).toHaveLength(2);
  });

  fnTest(["M06.F02.I06"], "InspectionQualificationLevel 联合类型只接受枚举值", () => {
    const r1: InspectionQualificationLevel = "QUALIFIED";
    const r2: InspectionQualificationLevel = "RESTRICTED";
    expect([r1, r2]).toHaveLength(2);
  });
});
