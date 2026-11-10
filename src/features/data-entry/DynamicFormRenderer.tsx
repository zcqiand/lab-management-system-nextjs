// ADR-0056：schema 驱动动态表单渲染器——component_path 退役后的唯一渲染路径。
// 渲染层零业务计算：schema.computed 按 variant ?? algorithm 派发到 models/algorithms.ts
// 算法注册表；无 schema（config 缺失/解析失败）回退通用四格采集卡（算法域 requirement.ts
// 出技术要求文本，契约不再收 requirementCode）。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InspectionStandard, TestRecord } from "@/api/endpoints/model";
import type {
  TechnicalRequirementRow as InspectionTechnicalRequirement,
  ParamModelProps,
} from "./models/types";
import { parseFormSchema, type FormSchema, type SchemaField } from "./models/schema";
import {
  initValuesFromSchema,
  runAlgorithm,
  type AlgorithmContext,
  type TableRowState,
} from "./models/algorithms";
import { requirementLabel } from "./models/requirement";
import { sieveColumns } from "./models/gradation";

const VERDICT_OPTIONS = ["合格", "不合格", "符合", "不符合"] as const;

/** 只读灰化样式（与退役卡一致：read-only/disabled 双形态）。 */
const numCls =
  "w-28 border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500";
const txtCls =
  "w-full border rounded px-2 py-1 text-sm read-only:bg-gray-50 read-only:text-gray-500";
const selCls =
  "border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500";

function numToInput(v: number): string | number {
  return v === 0 ? "" : v;
}

// —— 通用采集卡（无 schema 回退；DefaultParamCard 的契约正确版） ——

function GenericParamCard({
  parameter: p,
  record: rec,
  standards,
  stdParams,
  techReqs,
  onChange,
  readOnly = false,
}: ParamModelProps) {
  const basisOptions = stdParams
    .filter((sp) => sp.inspectionParameterCode === p.code)
    .map((sp) => standards.find((s) => s.code === sp.inspectionStandardCode))
    .filter((s): s is InspectionStandard => !!s);
  const reqOptions = techReqs.filter((r) => r.inspectionParameterCode === p.code);
  const inputVal = rec?.result ?? "";
  const basisVal = rec?.standardCode ?? "";
  const reqVal = rec?.requirement ?? "";
  const verdictVal = rec?.verdict ?? "";
  const passLabel = () => {
    if (!rec) return <span className="text-gray-400">未录入</span>;
    if (rec.verdict === "合格" || rec.verdict === "符合")
      return <span className="text-green-600">{rec.verdict}</span>;
    if (rec.verdict === "不合格" || rec.verdict === "不符合")
      return <span className="text-red-600">{rec.verdict}</span>;
    return <span className="text-gray-400">未评定</span>;
  };
  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {p.canonicalName || p.name}
          {p.unit ? `（${p.unit}）` : ""}
        </span>
        <span className="text-xs">{passLabel()}</span>
      </div>
      <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-xs">
        <div>
          <label className="block text-gray-500 mb-0.5">检测依据</label>
          <select
            aria-label="检测依据"
            value={basisVal}
            onChange={(e) => onChange({ standardCode: e.target.value })}
            disabled={readOnly}
            className={`w-full ${selCls}`}
          >
            <option value="">—</option>
            {basisOptions.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-500 mb-0.5">技术要求</label>
          <select
            aria-label="技术要求"
            value={reqVal}
            onChange={(e) => onChange({ requirement: e.target.value })}
            disabled={readOnly}
            className={`w-full ${selCls}`}
          >
            <option value="">{reqVal || "—"}</option>
            {reqOptions.map((r) => (
              <option key={r.id} value={requirementLabel(r)}>
                {requirementLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-500 mb-0.5">检测结果</label>
          <input
            value={inputVal}
            onChange={(e) => onChange({ result: e.target.value })}
            placeholder="录入检测结果"
            readOnly={readOnly}
            className={txtCls}
          />
        </div>
        <div>
          <label className="block text-gray-500 mb-0.5">单项评定</label>
          <select
            aria-label="单项评定"
            value={verdictVal}
            onChange={(e) => onChange({ verdict: e.target.value })}
            disabled={readOnly}
            className={`w-full ${selCls}`}
          >
            <option value="">未评定</option>
            {VERDICT_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// —— schema 表单体 ——

interface SchemaFormProps extends ParamModelProps {
  schema: FormSchema;
}

function SchemaForm({
  parameter: p,
  record,
  sampleId,
  standards: _standards,
  stdParams: _stdParams,
  techReqs,
  schema,
  calcRule,
  crossRecord,
  onChange,
  readOnly = false,
}: SchemaFormProps) {
  void _standards;
  void _stdParams;
  const init = useMemo(
    () =>
      initValuesFromSchema(schema, record?.data, record?.result, calcRule?.specimenCount),
    [schema, record?.data, record?.result, calcRule?.specimenCount],
  );
  const [values, setValues] = useState<Record<string, unknown>>(init);
  const [techReqSel, setTechReqSel] = useState<string>("");

  // 样品切换 / 落库回写 → 重置本地值（防跨样品串台）；keystroke 不重置。
  const resetKey = `${sampleId}|${JSON.stringify(record?.data)}|${JSON.stringify(record?.result)}`;
  const lastReset = useRef(resetKey);
  useEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    setValues(init);
    setTechReqSel("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 resetKey 变化时重置
  }, [resetKey]);

  const reqOptions = useMemo(
    () => techReqs.filter((r) => r.verificationStatus === "verified"),
    [techReqs],
  );
  const dataTechReqId =
    typeof record?.data?.["techReqId"] === "string"
      ? (record.data["techReqId"] as string)
      : "";
  const selectedReqId = techReqSel || dataTechReqId;
  const selReq: InspectionTechnicalRequirement | undefined =
    reqOptions.find((r) => r.id === selectedReqId) ?? reqOptions[0];

  // 算法派发（渲染层唯一计算入口）
  const outputs = useMemo(
    () =>
      schema.computed.map((c) =>
        runAlgorithm(c, {
          values,
          params: schema.params,
          specimenCount: calcRule?.specimenCount ?? 0,
          techReq: selReq,
          techReqId: selReq?.id ?? "",
          techReqLabel: selReq ? requirementLabel(selReq) : "",
          crossRecord,
        } satisfies AlgorithmContext),
      ),
    [schema, values, calcRule, selReq, crossRecord],
  );

  const autoVerdict = outputs.find(
    (o) => o.verdict === "合格" || o.verdict === "不合格",
  )?.verdict;
  const manualVerdictOptions = outputs.find(
    (o) => !o.verdict && o.manualVerdict,
  )?.manualVerdict;
  const needsTechReq = outputs.some((o) => o.needsTechReq);
  const lockInputs = outputs.some((o) => o.lockInputs);
  const warning = outputs.find((o) => o.warning)?.warning;

  const emitWith = useCallback(
    (nextValues: Record<string, unknown>, extra?: Partial<TestRecord>) => {
      if (readOnly) return;
      // 与 emit 相同的合并逻辑，但基于 nextValues 计算（keystroke 同步，不用 stale closure）
      const nextOutputs = schema.computed.map((c) =>
        runAlgorithm(c, {
          values: nextValues,
          params: schema.params,
          specimenCount: calcRule?.specimenCount ?? 0,
          techReq: selReq,
          techReqId: selReq?.id ?? "",
          techReqLabel: selReq ? requirementLabel(selReq) : "",
          crossRecord,
        } satisfies AlgorithmContext),
      );
      const nextData: Record<string, unknown> = { ...nextValues };
      for (const o of nextOutputs) Object.assign(nextData, o.data);
      const v = nextOutputs.find(
        (o) => o.verdict === "合格" || o.verdict === "不合格",
      )?.verdict;
      const needReq = nextOutputs.some((o) => o.needsTechReq);
      onChange({
        data: nextData,
        result: JSON.stringify(nextData),
        ...(v ? { verdict: v } : {}),
        ...(needReq && selReq ? { requirement: requirementLabel(selReq) } : {}),
        ...extra,
      });
    },
    [schema, calcRule, selReq, crossRecord, readOnly, onChange],
  );

  const updateValue = (field: string, v: unknown) => {
    if (readOnly) return;
    const next = { ...values, [field]: v };
    setValues(next);
    emitWith(next);
  };

  // 技术要求切换（含联立数据就绪后首次命中默认项）→ 立即重算并落 dirty
  const selReqKeyId = selReq?.id ?? "";
  const lastReqId = useRef(selReqKeyId);
  useEffect(() => {
    if (lastReqId.current === selReqKeyId) return;
    lastReqId.current = selReqKeyId;
    if (!selReqKeyId) return;
    emitWith(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅技术要求变化时同步一次
  }, [selReqKeyId]);

  const updateSeries = (field: string, i: number, v: number | string) => {
    if (readOnly) return;
    const arr = Array.isArray(values[field]) ? [...(values[field] as unknown[])] : [];
    arr[i] = v;
    updateValue(field, arr);
  };

  const updateTableRow = (field: string, ri: number, next: TableRowState) => {
    if (readOnly) return;
    const rows = Array.isArray(values[field])
      ? [...(values[field] as TableRowState[])]
      : [];
    rows[ri] = next;
    updateValue(field, rows);
  };

  // 联立自动（比值卡）：跨记录数据就绪/变化时同步一次落 dirty（序列化 dep 防重复触发）
  const isRatio =
    schema.computed[0]?.variant === "yield_ratio" ||
    schema.computed[0]?.algorithm === "auto_calc_ratio";
  const autoKey = isRatio ? JSON.stringify(outputs[0]?.data["strengths"] ?? []) : "";
  const lastAuto = useRef("");
  useEffect(() => {
    if (readOnly || !isRatio) return;
    const strengths = outputs[0]?.data["strengths"];
    const hasAuto =
      Array.isArray(strengths) && strengths.some((v) => typeof v === "number" && v > 0);
    if (!hasAuto) return;
    if (lastAuto.current === autoKey) return;
    lastAuto.current = autoKey;
    emitWith(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅联立结果变化时同步一次
  }, [autoKey, isRatio, readOnly]);

  const verdictShown = autoVerdict ?? record?.verdict ?? "";
  const verdictClass =
    verdictShown === "合格"
      ? "text-green-600"
      : verdictShown === "不合格"
        ? "text-red-600"
        : "text-gray-400";

  const renderField = (f: SchemaField) => {
    const raw = values[f.field];
    switch (f.type) {
      case "number_series": {
        const n = f.count ?? calcRule?.specimenCount ?? 2;
        const arr = numSeriesOf(raw, n);
        return (
          <div key={f.field} className="text-xs">
            <div className="text-gray-500 mb-1">{f.label}</div>
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: n }, (_, i) => (
                <input
                  key={i}
                  type="number"
                  step="0.01"
                  placeholder={f.label}
                  aria-label={`试件 ${i + 1} ${f.label}`}
                  value={numToInput(arr[i] ?? 0)}
                  onChange={(e) =>
                    updateSeries(
                      f.field,
                      i,
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  readOnly={readOnly || lockInputs}
                  className={numCls}
                />
              ))}
            </div>
          </div>
        );
      }
      case "number": {
        return (
          <div key={f.field} className="text-xs">
            <label className="block text-gray-500 mb-0.5">{f.label}</label>
            <input
              type="number"
              step="0.001"
              aria-label={f.label}
              value={numToInput(typeof raw === "number" ? raw : 0)}
              onChange={(e) =>
                updateValue(f.field, e.target.value === "" ? 0 : Number(e.target.value))
              }
              readOnly={readOnly}
              className={numCls}
            />
          </div>
        );
      }
      case "input_series": {
        const n = f.count ?? calcRule?.specimenCount ?? 2;
        const arr = strSeriesOf(raw, n);
        return (
          <div key={f.field} className="text-xs">
            <div className="text-gray-500 mb-1">{f.label}</div>
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: n }, (_, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={f.label}
                  aria-label={`试件 ${i + 1} ${f.label}`}
                  value={arr[i] ?? ""}
                  onChange={(e) => updateSeries(f.field, i, e.target.value)}
                  readOnly={readOnly}
                  className={numCls}
                />
              ))}
            </div>
          </div>
        );
      }
      case "select_series": {
        const n = f.count ?? calcRule?.specimenCount ?? 2;
        const arr = strSeriesOf(raw, n);
        const opts = f.options ?? [];
        return (
          <div key={f.field} className="text-xs">
            <div className="text-gray-500 mb-1">{f.label}</div>
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: n }, (_, i) => (
                <select
                  key={i}
                  aria-label={`试件 ${i + 1} ${f.label}`}
                  value={arr[i] ?? opts[0] ?? ""}
                  onChange={(e) => updateSeries(f.field, i, e.target.value)}
                  disabled={readOnly}
                  className={selCls}
                >
                  {opts.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        );
      }
      case "select": {
        const opts = f.options ?? [];
        return (
          <div key={f.field} className="text-xs">
            <label className="block text-gray-500 mb-0.5">{f.label}</label>
            <select
              aria-label={f.label}
              value={typeof raw === "string" ? raw : ""}
              onChange={(e) => updateValue(f.field, e.target.value)}
              disabled={readOnly}
              className={selCls}
            >
              <option value="">—</option>
              {opts.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
      case "textarea": {
        return (
          <div key={f.field} className="text-xs">
            <label className="block text-gray-500 mb-0.5">{f.label}</label>
            <textarea
              aria-label={f.label}
              rows={2}
              value={typeof raw === "string" ? raw : ""}
              onChange={(e) => updateValue(f.field, e.target.value)}
              readOnly={readOnly}
              className={txtCls}
            />
          </div>
        );
      }
      case "input": {
        return (
          <div key={f.field} className="text-xs">
            <label className="block text-gray-500 mb-0.5">{f.label}</label>
            <input
              type="text"
              aria-label={f.label}
              value={typeof raw === "string" ? raw : ""}
              onChange={(e) => updateValue(f.field, e.target.value)}
              readOnly={readOnly}
              className={txtCls}
            />
          </div>
        );
      }
      case "table": {
        const cols = f.columnOptions ?? sieveColumns(schema.params);
        const rows = tableRowsOf(raw, f.rows ?? 2, cols.length);
        const extras = f.rowExtras ?? [];
        return (
          <div key={f.field} className="text-xs space-y-2">
            <div className="text-gray-500">{f.label}</div>
            <table className="w-full text-xs border-collapse">
              <thead className="text-gray-500">
                <tr>
                  <th className="border border-gray-300 px-2 py-1 text-left">序号</th>
                  {cols.map((c) => (
                    <th
                      key={c}
                      className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                  {extras.map((ex) => (
                    <th
                      key={ex.field}
                      className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap"
                    >
                      {ex.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className="border border-gray-300 px-2 py-1 text-center font-medium">
                      {ri + 1}
                    </td>
                    {cols.map((c, ci) => (
                      <td
                        key={c}
                        className="border border-gray-300 px-1 py-1 text-center"
                      >
                        <input
                          type="number"
                          step="0.1"
                          aria-label={`第 ${ri + 1} 行 ${c}`}
                          value={numToInput(row.cells[ci] ?? 0)}
                          onChange={(e) => {
                            const cells = [...row.cells];
                            cells[ci] =
                              e.target.value === "" ? 0 : Number(e.target.value);
                            updateTableRow(f.field, ri, { ...row, cells });
                          }}
                          onBlur={() => emitWith(values)}
                          readOnly={readOnly}
                          className="w-16 border rounded px-1 py-0.5 text-center read-only:bg-gray-50 read-only:text-gray-500"
                        />
                      </td>
                    ))}
                    {extras.map((ex) => (
                      <td
                        key={ex.field}
                        className="border border-gray-300 px-1 py-1 text-center"
                      >
                        <input
                          type="number"
                          step="1"
                          aria-label={`第 ${ri + 1} 行 ${ex.label}`}
                          value={numToInput(row.extras[ex.field] ?? 0)}
                          onChange={(e) => {
                            const nextExtras = {
                              ...row.extras,
                              [ex.field]:
                                e.target.value === "" ? 0 : Number(e.target.value),
                            };
                            updateTableRow(f.field, ri, { ...row, extras: nextExtras });
                          }}
                          onBlur={() => emitWith(values)}
                          readOnly={readOnly}
                          className="w-20 border rounded px-1 py-0.5 text-center read-only:bg-gray-50 read-only:text-gray-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {p.canonicalName || p.name}
          {p.unit ? `（${p.unit}）` : ""}
        </span>
        <span className={`text-xs ${verdictClass}`}>{verdictShown || "未评定"}</span>
      </div>

      {schema.fields.map(renderField)}

      {needsTechReq && (
        <div className="text-xs flex items-center gap-3 bg-gray-50 rounded p-2">
          <span className="text-gray-500">
            技术要求
            <select
              value={selReq?.id ?? ""}
              onChange={(e) => {
                if (readOnly) return;
                setTechReqSel(e.target.value);
              }}
              disabled={readOnly}
              aria-label="技术要求"
              className={`ml-1 ${selCls}`}
            >
              <option value="">未选</option>
              {reqOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {requirementLabel(r)}
                </option>
              ))}
            </select>
          </span>
          {warning && <span className="text-red-500">（{warning}）</span>}
        </div>
      )}
      {warning && !needsTechReq && (
        <div className="text-xs text-red-500">（{warning}）</div>
      )}

      {schema.computed.map((c, i) => {
        const o = outputs[i];
        if (!o) return null;
        return (
          <div key={c.field} className="text-xs text-gray-600 space-y-1">
            {o.display !== undefined && (
              <div>
                {c.label}：<span className="font-medium text-gray-900">{o.display}</span>
              </div>
            )}
            {(o.displayLines ?? []).map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        );
      })}

      {!autoVerdict && manualVerdictOptions && (
        <div className="text-xs">
          <label className="text-gray-500 mr-1">单项评定</label>
          <select
            aria-label="单项评定"
            value={record?.verdict ?? ""}
            onChange={(e) => {
              if (readOnly) return;
              onChange({ verdict: e.target.value });
            }}
            disabled={readOnly}
            className={selCls}
          >
            <option value="">未评定</option>
            {manualVerdictOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// —— 序列取值小工具 ——

function numSeriesOf(raw: unknown, n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const x = Array.isArray(raw) ? raw[i] : undefined;
    return typeof x === "number" && Number.isFinite(x) ? x : 0;
  });
}

function strSeriesOf(raw: unknown, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const x = Array.isArray(raw) ? raw[i] : undefined;
    return typeof x === "string" ? x : "";
  });
}

function tableRowsOf(raw: unknown, rowCount: number, colCount: number): TableRowState[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: Math.max(rowCount, arr.length) }, (_, ri) => {
    const r = (arr[ri] ?? {}) as Partial<TableRowState>;
    const cells = Array.isArray(r.cells)
      ? r.cells.map((x) => (typeof x === "number" && Number.isFinite(x) ? x : 0))
      : [];
    while (cells.length < colCount) cells.push(0);
    const extras: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.extras ?? {})) {
      extras[k] = typeof v === "number" && Number.isFinite(v) ? v : 0;
    }
    return { cells, extras };
  });
}

// —— 顶层派发 ——

export function DynamicFormRenderer(props: ParamModelProps) {
  const schema = useMemo(() => parseFormSchema(props.config), [props.config]);
  if (!schema) return <GenericParamCard {...props} />;
  return <SchemaForm {...props} schema={schema} />;
}

export default DynamicFormRenderer;
