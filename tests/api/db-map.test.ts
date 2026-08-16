import { describe, it, expect } from "vitest";
import { toCamel, rowToDto, dtoToRow } from "@/lib/db-map";

describe("row↔DTO 映射", () => {
  it("toCamel: snake → camel", () => {
    expect(toCamel("contract_code")).toBe("contractCode");
    expect(toCamel("inspection_specialty_code")).toBe("inspectionSpecialtyCode");
    expect(toCamel("code")).toBe("code");
  });
  it("rowToDto: 整行 snake → camel，值原样", () => {
    const row = { contract_code: "C-1", client_unit: "甲", flow_history: [{ action: "submit" }] };
    const dto = rowToDto(row);
    expect(dto).toEqual({ contractCode: "C-1", clientUnit: "甲", flowHistory: [{ action: "submit" }] });
  });
  it("dtoToRow: camel → snake", () => {
    expect(dtoToRow({ contractCode: "C-1", flowHistory: [] })).toEqual({
      contract_code: "C-1", flow_history: [],
    });
  });
});
