"use client";
// REF src/features/inspection-capability/AssociationManager.tsx 移植。
// TSOT Phase C2：legacy apiClient/API_ROUTES 全部替换为 orval 生成函数。
// REF 字面 junction/主表路由 → 契约端点的分发表在文件顶部（键封闭，4 类 junction
// + 3 张主表）；组件 Props 形状保持不变（调用方 ReportNameList / ParamInterfaceList
// 不感知迁移）。unlink 按 SSOT 走 @body（不再带 query 双发）。
import { useEffect, useState } from "react";
import {
  inspectionDictionaryLinkObjectParameter,
  inspectionDictionaryLinkObjectStandard,
  inspectionDictionaryListObjectParameterLinks,
  inspectionDictionaryListObjects,
  inspectionDictionaryListObjectStandardLinks,
  inspectionDictionaryListParameters,
  inspectionDictionaryListStandards,
  inspectionDictionaryUnlinkObjectParameter,
  inspectionDictionaryUnlinkObjectStandard,
} from "@/api/endpoints/inspection-dictionary/inspection-dictionary";
import {
  paramInterfacesLinkParamInterface,
  paramInterfacesListParamInterfaceLinks,
  paramInterfacesUnlinkParamInterface,
} from "@/api/endpoints/param-interfaces/param-interfaces";
import {
  reportNamesLinkObjectReportName,
  reportNamesLinkReportNameParameter,
  reportNamesLinkReportNameStandard,
  reportNamesListObjectReportNameLinks,
  reportNamesListReportNameParameterLinks,
  reportNamesListReportNameStandardLinks,
  reportNamesUnlinkObjectReportName,
  reportNamesUnlinkReportNameParameter,
  reportNamesUnlinkReportNameStandard,
} from "@/api/endpoints/report-names/report-names";
import type {
  InspectionDictionaryListObjectParameterLinksParams,
  InspectionDictionaryListObjectStandardLinksParams,
  InspectionDictionaryUnlinkObjectParameterBody,
  InspectionDictionaryUnlinkObjectStandardBody,
  ObjectParameterLink,
  ObjectReportNameLink,
  ObjectStandardLink,
  ParamInterfaceLink,
  ParamInterfacesUnlinkParamInterfaceBody,
  ReportNameParameterLink,
  ReportNameStandardLink,
  ReportNamesListObjectReportNameLinksParams,
  ReportNamesListReportNameParameterLinksParams,
  ReportNamesListReportNameStandardLinksParams,
  ReportNamesUnlinkObjectReportNameBody,
  ReportNamesUnlinkReportNameParameterBody,
  ReportNamesUnlinkReportNameStandardBody,
} from "@/api/endpoints/model";

type Row = Record<string, string>;

/** 8 类 junction 的契约 link CRUD（list 已按 parentCode 过滤）。 */
const JUNCTION_API: Record<
  string,
  {
    list: (parentCode: string) => Promise<Row[]>;
    add: (payload: Row) => Promise<unknown>;
    remove: (payload: Row) => Promise<unknown>;
  }
> = {
  // 项目↔参数（含资质级别）——InspectionCapabilityFormModal「关联检测参数」页签用
  "/inspection-object-parameters": {
    list: (parentCode) =>
      inspectionDictionaryListObjectParameterLinks({
        inspectionObjectCode: parentCode,
      } satisfies InspectionDictionaryListObjectParameterLinksParams).then(
        (r) => (r.items ?? []) as unknown as Row[],
      ),
    add: (p) =>
      inspectionDictionaryLinkObjectParameter(p as unknown as ObjectParameterLink),
    remove: (p) =>
      inspectionDictionaryUnlinkObjectParameter(
        p as unknown as InspectionDictionaryUnlinkObjectParameterBody,
      ),
  },
  // 项目↔标准（含 role 检测/判定依据）——InspectionCapabilityFormModal「关联检测标准」页签用
  "/inspection-object-standards": {
    list: (parentCode) =>
      inspectionDictionaryListObjectStandardLinks({
        inspectionObjectCode: parentCode,
      } satisfies InspectionDictionaryListObjectStandardLinksParams).then(
        (r) => (r.items ?? []) as unknown as Row[],
      ),
    add: (p) =>
      inspectionDictionaryLinkObjectStandard(p as unknown as ObjectStandardLink),
    remove: (p) =>
      inspectionDictionaryUnlinkObjectStandard(
        p as unknown as InspectionDictionaryUnlinkObjectStandardBody,
      ),
  },
  "/inspection-object-report-names": {
    list: (parentCode) =>
      reportNamesListObjectReportNameLinks({
        reportNameCode: parentCode,
      } satisfies ReportNamesListObjectReportNameLinksParams).then(
        // ObjectReportNameLink（纯可选性接口）与 Row 无结构重叠，
        // 需经 unknown 中转（同款 add/remove 的 as unknown as 惯例）
        (r) => (r.items ?? []) as unknown as Row[],
      ),
    add: (p) => reportNamesLinkObjectReportName(p as unknown as ObjectReportNameLink),
    remove: (p) =>
      reportNamesUnlinkObjectReportName(
        p as unknown as ReportNamesUnlinkObjectReportNameBody,
      ),
  },
  "/inspection-report-name-standards": {
    list: (parentCode) =>
      reportNamesListReportNameStandardLinks({
        reportNameCode: parentCode,
      } satisfies ReportNamesListReportNameStandardLinksParams).then(
        (r) => (r.items ?? []) as unknown as Row[],
      ),
    add: (p) => reportNamesLinkReportNameStandard(p as unknown as ReportNameStandardLink),
    remove: (p) =>
      reportNamesUnlinkReportNameStandard(
        p as unknown as ReportNamesUnlinkReportNameStandardBody,
      ),
  },
  "/inspection-report-name-parameters": {
    list: (parentCode) =>
      reportNamesListReportNameParameterLinks({
        reportNameCode: parentCode,
      } satisfies ReportNamesListReportNameParameterLinksParams).then(
        (r) => (r.items ?? []) as unknown as Row[],
      ),
    add: (p) =>
      reportNamesLinkReportNameParameter(p as unknown as ReportNameParameterLink),
    remove: (p) =>
      reportNamesUnlinkReportNameParameter(
        p as unknown as ReportNamesUnlinkReportNameParameterBody,
      ),
  },
  "/inspection-parameter-param-interfaces": {
    list: (parentCode) =>
      paramInterfacesListParamInterfaceLinks({
        paramInterfaceCode: parentCode,
      }).then((r) => (r.items ?? []) as unknown as Row[]),
    add: (p) => paramInterfacesLinkParamInterface(p as unknown as ParamInterfaceLink),
    remove: (p) =>
      paramInterfacesUnlinkParamInterface(
        p as unknown as ParamInterfacesUnlinkParamInterfaceBody,
      ),
  },
};

/** 下拉数据源主表（契约 list 端点，1 页大页拉全量）。 */
const MASTER_LIST: Record<string, () => Promise<Row[]>> = {
  "/inspection-objects": () =>
    inspectionDictionaryListObjects({ page: 1, pageSize: 1000 }).then(
      (r) => (r.items ?? []) as unknown as Row[],
    ),
  "/inspection-standards": () =>
    inspectionDictionaryListStandards({ page: 1, pageSize: 1000 }).then(
      (r) => (r.items ?? []) as unknown as Row[],
    ),
  "/inspection-parameters": () =>
    inspectionDictionaryListParameters({ page: 1, pageSize: 1000 }).then(
      (r) => (r.items ?? []) as unknown as Row[],
    ),
};

interface ExtraField {
  name: string;
  label: string;
  type?: "text" | "select";
  options?: string[];
  valueLabels?: Record<string, string>; // 枚举值 → 中文呈现（值仍存英文枚举）
  rowPrefix?: Record<string, string>; // 枚举值 → 行内前缀（如【检测依据】/*），有则不再显示后缀
  /**
   * 是否按此字段值分组渲染（替代 rowPrefix）
   * - 设 true：用 valueLabels[role] 作为组标题（如"检测依据"），组内行不再有前缀
   * - 适用于 role 字段（JUDGMENT/TESTING 分组），比行内前缀更可读
   */
  groupBy?: boolean;
}

/**
 * prefilter：在 target 下拉之前加一层过滤（如 先选「检测项目」再选「检测参数」）。
 * 工作机制：选 prefilter 值 → 按 filterEndpoint 反查 filterResultKey 集合 → 用来过滤 target 下拉。
 * 实际写入目标的 payload 不含 prefilter 字段——prefilter 只是 UI 收敛手段，不改 API 契约。
 */
interface PrefilterConfig {
  /** prefilter 下拉的标签，如 "检测项目" */
  label: string;
  /** prefilter 列表来源（当前唯一用法：/inspection-objects） */
  endpoint: string;
  /** prefilter 选项 value 字段，如 code */
  valueKey: string;
  /** prefilter 选项显示字段，如 name */
  textKey: string;
  /** prefilter 选中后，用来反查允许 target 集合的 endpoint（当前唯一用法：/inspection-object-parameters） */
  filterEndpoint: string;
  /** 反查时用的 query param key（prefilter value 字段名），如 inspectionObjectCode */
  filterParamKey: string;
  /** 反查结果里 target code 的字段名，如 inspectionParameterCode */
  filterResultKey: string;
}

interface Props {
  ariaLabel: string;
  endpoint: string; // 如 /inspection-object-report-names（查 JUNCTION_API）
  parentParam: string; // 如 reportNameCode
  parentCode: string;
  targetLabel: string; // 如 "检测参数"
  targetEndpoint: string; // 如 /inspection-parameters（查 MASTER_LIST）
  targetParam: string; // 如 inspectionParameterCode
  targetValueKey: string; // 目标下拉 value 字段（通常 code）
  targetTextKey: string; // 目标下拉 显示字段（通常 name）
  /** 额外附加显示字段（如标准的 name），会跟在主文本后以 " · value" 形式追加 */
  targetExtraTextKey?: string;
  extraFields?: ExtraField[]; // role / qualificationLevel+sortOrder
  /** 可选：先选 prefilter 再选 target；设了就启用两级下拉 */
  prefilter?: PrefilterConfig;
  /**
   * 可选：行渲染追加「· 对象名」。开启后会额外拉 object-parameter links 和
   * /api/inspection/objects 全量构建 parameterCode → objectNames[] 映射。
   * 用于"参数跨多对象"场景（如报告名称/参数界面的关联参数页签），让用户看到该参数所归属的检测项目。
   * 同一参数跨多对象时按对象名顺序拼接「· A · B」。默认 false（不拉不渲染）。
   */
  showParameterObjects?: boolean;
  fnId?: string; // data-fn 锚点
}

export function AssociationManager(props: Props) {
  const {
    ariaLabel,
    endpoint,
    parentParam,
    parentCode,
    targetLabel,
    targetEndpoint,
    targetParam,
    targetValueKey,
    targetTextKey,
    targetExtraTextKey,
    extraFields = [],
    prefilter,
    showParameterObjects = false,
    fnId,
  } = props;
  const [rows, setRows] = useState<Row[]>([]);
  const [targets, setTargets] = useState<Row[]>([]);
  const [prefilterOptions, setPrefilterOptions] = useState<Row[]>([]);
  const [prefilterSelected, setPrefilterSelected] = useState("");
  const [allowedTargetCodes, setAllowedTargetCodes] = useState<Set<string> | null>(null);
  const [parameterObjectNames, setParameterObjectNames] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [selected, setSelected] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = () => {
    const junction = JUNCTION_API[endpoint];
    if (!junction) {
      setError(`未知关联端点：${endpoint}`);
      setRows([]);
      return;
    }
    junction
      .list(parentCode)
      .then((items) => setRows(items))
      .catch(() => setError("加载失败"));
    const listTargets = MASTER_LIST[targetEndpoint];
    if (listTargets) {
      listTargets()
        .then((items) => setTargets(items))
        .catch(() => {});
    }
    if (prefilter) {
      const listPrefilter = MASTER_LIST[prefilter.endpoint];
      if (listPrefilter) {
        listPrefilter()
          .then((items) => setPrefilterOptions(items))
          .catch(() => {});
      }
    }
    if (showParameterObjects) {
      // 拉 object-parameter links + /api/inspection/objects 全量构建 parameterCode → objectNames[] 映射
      Promise.all([
        inspectionDictionaryListObjectParameterLinks({}),
        inspectionDictionaryListObjects({ page: 1, pageSize: 1000 }),
      ])
        .then(([iop, io]) => {
          const objectNameByCode = new Map<string, string>();
          for (const o of (io.items ?? []) as unknown as Row[]) {
            const c = String(o.code ?? "");
            if (c) objectNameByCode.set(c, String(o.name ?? c));
          }
          const m = new Map<string, string[]>();
          for (const r of (iop.items ?? []) as unknown as Row[]) {
            const p = String(r.inspectionParameterCode ?? "");
            const o = String(r.inspectionObjectCode ?? "");
            if (!p || !o) continue;
            const arr = m.get(p) ?? [];
            const name = objectNameByCode.get(o) ?? o;
            if (!arr.includes(name)) arr.push(name);
            m.set(p, arr);
          }
          setParameterObjectNames(m);
        })
        .catch(() => setParameterObjectNames(new Map()));
    } else {
      setParameterObjectNames(new Map());
    }
  };
  // 仅在父级/target/prefilter 端点切换时重新加载；selected/extra/prefilterSelected 是纯本地表单态，不触发重拉。
  // prefilter 是配置块，调用方按字面量传入；整对象进 deps 会在父级每次 render 都重拉。改按 sub-field 触发。
  // showParameterObjects 是布尔配置，加进 deps 触发一次性拉取（行渲染只读 parameterObjectNames）。
  /* eslint-disable react-hooks/exhaustive-deps -- prefilter 是配置块 */
  useEffect(loadAll, [
    endpoint,
    parentParam,
    parentCode,
    targetEndpoint,
    prefilter?.endpoint,
    showParameterObjects,
  ]);

  // prefilter 选中后，反查允许的 target 集合（当前唯一形态：检测项目 → object-parameter links）
  useEffect(() => {
    if (!prefilter) {
      setAllowedTargetCodes(null);
      return;
    }
    if (!prefilterSelected) {
      setAllowedTargetCodes(null);
      setSelected("");
      return;
    }
    inspectionDictionaryListObjectParameterLinks({
      inspectionObjectCode: prefilterSelected,
    })
      .then((res) => {
        const codes = new Set<string>();
        for (const r of (res.items ?? []) as unknown as Row[]) {
          const c = r[prefilter.filterResultKey];
          if (c) codes.add(String(c));
        }
        setAllowedTargetCodes(codes);
        setSelected(""); // 过滤集变了，target 选中清空
      })
      .catch(() => setError("加载过滤集合失败"));
  }, [
    prefilterSelected,
    prefilter?.filterEndpoint,
    prefilter?.filterParamKey,
    prefilter?.filterResultKey,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const junction = JUNCTION_API[endpoint];
    if (!junction) {
      setError(`未知关联端点：${endpoint}`);
      setBusy(false);
      return;
    }
    const payload: Row = {
      [parentParam]: parentCode,
      [targetParam]: selected,
      ...extra,
    };
    try {
      const body = (await junction.add(payload)) as unknown;
      if (
        body &&
        typeof body === "object" &&
        "message" in (body as { message?: string })
      ) {
        setError((body as { message: string }).message);
      } else {
        setSelected("");
        setExtra({});
        loadAll();
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "添加失败",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (targetCode: string, row: Row) => {
    setBusy(true);
    setError(null);
    const junction = JUNCTION_API[endpoint];
    if (!junction) {
      setError(`未知关联端点：${endpoint}`);
      setBusy(false);
      return;
    }
    const payload: Row = {
      [parentParam]: parentCode,
      [targetParam]: targetCode,
    };
    for (const f of extraFields) {
      const v = row[f.name];
      if (v !== undefined) payload[f.name] = v;
    }
    try {
      // 契约 unlink 是 @body 语义（REQ-2026-001 SSOT），不再双发 query。
      await junction.remove(payload);
      loadAll();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "移除失败",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-fn={fnId} aria-label={ariaLabel} className="space-y-3">
      {error && (
        <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      <ul className="text-sm divide-y">
        {rows.length === 0 && <li className="px-1 py-2 text-gray-400">暂无关联</li>}
        {(() => {
          // 找出第一个声明 groupBy 的字段（通常只一个：role）
          const groupingField = extraFields.find((f) => f.groupBy);
          if (groupingField) {
            // 按 groupingField 值聚合行；空值排到最后
            const groups = new Map<string, Row[]>();
            for (const r of rows) {
              const k = r[groupingField.name] ?? "";
              const arr = groups.get(k) ?? [];
              arr.push(r);
              groups.set(k, arr);
            }
            const orderedKeys = [...groups.keys()].sort((a, b) => {
              if (!a) return 1;
              if (!b) return -1;
              return a.localeCompare(b);
            });
            const out: React.ReactNode[] = [];
            for (const key of orderedKeys) {
              if (key) {
                out.push(
                  <li
                    key={`__hdr_${key}`}
                    className="px-1 pt-3 pb-1 text-xs font-semibold text-gray-700 bg-gray-50 border-b"
                    data-group-hdr={key}
                  >
                    {groupingField.valueLabels?.[key] ?? key}
                  </li>,
                );
              }
              for (const r of groups.get(key) ?? []) {
                const code = r[targetParam] ?? "";
                const target = targets.find((t) => t[targetValueKey] === code);
                const display = target?.[targetTextKey] ?? code;
                const extraText = targetExtraTextKey
                  ? target?.[targetExtraTextKey]
                  : undefined;
                out.push(
                  <li
                    key={code + extraFields.map((f) => r[f.name] ?? "").join("#")}
                    className="flex items-center justify-between px-1 py-2"
                  >
                    <span>
                      {display}
                      {extraText && extraText !== display ? ` · ${extraText}` : ""}
                      {showParameterObjects &&
                        (parameterObjectNames.get(code) ?? [])
                          .map((n) => ` · ${n}`)
                          .join("")}
                      {extraFields
                        .filter((f) => !f.rowPrefix && !f.groupBy)
                        .map(
                          (f) =>
                            ` · ${f.label}: ${f.valueLabels?.[r[f.name] ?? ""] ?? r[f.name] ?? ""}`,
                        )
                        .join("")}
                    </span>
                    <button
                      type="button"
                      aria-label={`移除 ${code}`}
                      disabled={busy}
                      onClick={() => remove(code, r)}
                      className="text-red-600 hover:underline disabled:opacity-40"
                    >
                      移除
                    </button>
                  </li>,
                );
              }
            }
            return out;
          }
          // 非分组模式保持原 rowPrefix 行为
          return rows.map((r) => {
            const code = r[targetParam] ?? "";
            const target = targets.find((t) => t[targetValueKey] === code);
            const display = target?.[targetTextKey] ?? code;
            const extraText = targetExtraTextKey
              ? target?.[targetExtraTextKey]
              : undefined;
            return (
              <li
                key={code + extraFields.map((f) => r[f.name] ?? "").join("#")}
                className="flex items-center justify-between px-1 py-2"
              >
                <span>
                  {extraFields
                    .filter((f) => f.rowPrefix)
                    .map((f) => f.rowPrefix?.[r[f.name] ?? ""] ?? "")
                    .join("")}
                  {display}
                  {extraText && extraText !== display ? ` · ${extraText}` : ""}
                  {showParameterObjects &&
                    (parameterObjectNames.get(code) ?? []).map((n) => ` · ${n}`).join("")}
                  {extraFields
                    .filter((f) => !f.rowPrefix)
                    .map(
                      (f) =>
                        ` · ${f.label}: ${f.valueLabels?.[r[f.name] ?? ""] ?? r[f.name] ?? ""}`,
                    )
                    .join("")}
                </span>
                <button
                  type="button"
                  aria-label={`移除 ${code}`}
                  disabled={busy}
                  onClick={() => remove(code, r)}
                  className="text-red-600 hover:underline disabled:opacity-40"
                >
                  移除
                </button>
              </li>
            );
          });
        })()}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        {prefilter && (
          <label className="text-sm">
            <span className="text-xs text-gray-600">{prefilter.label}</span>
            <select
              aria-label={`选择${prefilter.label}`}
              value={prefilterSelected}
              onChange={(e) => setPrefilterSelected(e.target.value)}
              className="ml-1 border rounded px-2 py-1"
            >
              <option value="">选择{prefilter.label}</option>
              {prefilterOptions.map((o) => (
                <option
                  key={o[prefilter.valueKey] ?? ""}
                  value={o[prefilter.valueKey] ?? ""}
                >
                  {o[prefilter.textKey] ?? ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="text-xs text-gray-600">{targetLabel}</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!!prefilter && !prefilterSelected}
            className="ml-1 border rounded px-2 py-1 disabled:opacity-50"
          >
            <option value="">
              {!prefilter
                ? `选择${targetLabel}`
                : prefilterSelected
                  ? `选择${targetLabel}`
                  : `请先选择${prefilter.label}`}
            </option>
            {targets
              .filter(
                (t) =>
                  !allowedTargetCodes ||
                  allowedTargetCodes.has(String(t[targetValueKey] ?? "")),
              )
              .map((t) => {
                const extra = targetExtraTextKey ? t[targetExtraTextKey] : undefined;
                return (
                  <option key={t[targetValueKey] ?? ""} value={t[targetValueKey] ?? ""}>
                    {t[targetTextKey] ?? ""}
                    {extra && extra !== t[targetTextKey] ? ` · ${extra}` : ""}
                  </option>
                );
              })}
          </select>
        </label>
        {extraFields.map((f) => (
          <label key={f.name} className="text-sm">
            <span className="text-xs text-gray-600">{f.label}</span>
            {f.type === "select" ? (
              <select
                value={extra[f.name] ?? ""}
                onChange={(e) => setExtra({ ...extra, [f.name]: e.target.value })}
                className="ml-1 border rounded px-2 py-1"
              >
                <option value="">（选）</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {f.valueLabels?.[o] ?? o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={extra[f.name] ?? ""}
                onChange={(e) => setExtra({ ...extra, [f.name]: e.target.value })}
                className="ml-1 border rounded px-2 py-1"
              />
            )}
          </label>
        ))}
        <button
          type="button"
          onClick={add}
          disabled={busy || !selected}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
        >
          添加
        </button>
      </div>
    </div>
  );
}

export default AssociationManager;
