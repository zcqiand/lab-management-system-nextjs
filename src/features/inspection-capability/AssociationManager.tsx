"use client";
// REF src/features/inspection-capability/AssociationManager.tsx 移植。
// 差异：apiClient → @/api/legacy-client；REF 字面路由经 route() 查 API_ROUTES
// （junction 端点映射到 lab-msw /api/inspection/links/* 等，键与 REF 字面量一致）。
import { useEffect, useState } from "react";
import { apiClient, API_ROUTES } from "@/api/legacy-client";

/** REF 字面路由 → lab-msw 路由；未登记的回退原样（防御）。 */
function route(p: string): string {
  return (API_ROUTES as Record<string, string>)[p] ?? p;
}

interface ExtraField {
  name: string;
  label: string;
  type?: "text" | "select";
  options?: string[];
  valueLabels?: Record<string, string>; // 枚举值 → 中文呈现（值仍存英文枚举）
  rowPrefix?: Record<string, string>; // 枚举值 → 行内前缀（如【检测依据】/*），有则不再显示后缀
}

/**
 * prefilter：在 target 下拉之前加一层过滤（如 先选「检测项目」再选「检测参数」）。
 * 工作机制：选 prefilter 值 → 拉 `filterEndpoint?{filterParamKey}=value` → 拿到 filterResultKey 集合 → 用来过滤 target 下拉。
 * 实际写入目标的 payload 不含 prefilter 字段——prefilter 只是 UI 收敛手段，不改 API 契约。
 */
interface PrefilterConfig {
  /** prefilter 下拉的标签，如 "检测项目" */
  label: string;
  /** prefilter 列表的 endpoint，如 /inspection-objects */
  endpoint: string;
  /** prefilter 选项 value 字段，如 code */
  valueKey: string;
  /** prefilter 选项显示字段，如 name */
  textKey: string;
  /** prefilter 选中后，用来反查允许 target 集合的 endpoint，如 /inspection-object-parameters */
  filterEndpoint: string;
  /** 反查时用的 query param key（prefilter value 字段名），如 inspectionObjectCode */
  filterParamKey: string;
  /** 反查结果里 target code 的字段名，如 inspectionParameterCode */
  filterResultKey: string;
}

interface Props {
  ariaLabel: string;
  endpoint: string; // 如 /inspection-object-parameters
  parentParam: string; // 如 inspectionObjectCode
  parentCode: string;
  targetLabel: string; // 如 "检测参数"
  targetEndpoint: string; // 如 /inspection-parameters
  targetParam: string; // 如 inspectionParameterCode
  targetValueKey: string; // 目标下拉 value 字段（通常 code）
  targetTextKey: string; // 目标下拉 显示字段（通常 name）
  /** 额外附加显示字段（如标准的 name），会跟在主文本后以 " · value" 形式追加 */
  targetExtraTextKey?: string;
  extraFields?: ExtraField[]; // role / qualificationLevel+sortOrder
  /** 可选：先选 prefilter 再选 target；设了就启用两级下拉 */
  prefilter?: PrefilterConfig;
  /**
   * 可选：行渲染追加「· 对象名」。开启后会额外拉 `/inspection-object-parameters?pageSize=10000`
   * 和 `/inspection-objects?pageSize=1000` 全量构建 parameterCode → objectNames[] 映射。
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
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [targets, setTargets] = useState<Array<Record<string, string>>>([]);
  const [prefilterOptions, setPrefilterOptions] = useState<Array<Record<string, string>>>([]);
  const [prefilterSelected, setPrefilterSelected] = useState("");
  const [allowedTargetCodes, setAllowedTargetCodes] = useState<Set<string> | null>(null);
  const [parameterObjectNames, setParameterObjectNames] = useState<Map<string, string[]>>(new Map());
  const [selected, setSelected] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = () => {
    apiClient
      .get<{ items: Array<Record<string, string>> }>(route(endpoint), {
        params: { [parentParam]: parentCode, page: 1, pageSize: "200" },
      })
      .then((res) => setRows(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setError("加载失败"));
    apiClient
      .get<{ items: Array<Record<string, string>> }>(route(targetEndpoint), {
        params: { page: 1, pageSize: "1000" },
      })
      .then((res) => setTargets(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => {});
    if (prefilter) {
      apiClient
        .get<{ items: Array<Record<string, string>> }>(route(prefilter.endpoint), {
          params: { page: 1, pageSize: "1000" },
        })
        .then((res) =>
          setPrefilterOptions(Array.isArray(res.data?.items) ? res.data.items : []),
        )
        .catch(() => {});
    }
    if (showParameterObjects) {
      // 拉 inspection-object-parameters + inspection-objects 全量构建 parameterCode → objectNames[] 映射
      Promise.all([
        apiClient.get<{ items: Array<Record<string, string>> }>(route("/inspection-object-parameters"), {
          params: { page: 1, pageSize: "10000" },
        }),
        apiClient.get<{ items: Array<Record<string, string>> }>(route("/inspection-objects"), {
          params: { page: 1, pageSize: "1000" },
        }),
      ])
        .then(([iop, io]) => {
          const objectNameByCode = new Map<string, string>();
          for (const o of io.data?.items ?? []) {
            const c = String(o.code ?? "");
            if (c) objectNameByCode.set(c, String(o.name ?? c));
          }
          const m = new Map<string, string[]>();
          for (const r of iop.data?.items ?? []) {
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
  useEffect(loadAll, [endpoint, parentParam, parentCode, targetEndpoint, prefilter?.endpoint, showParameterObjects]);

  // prefilter 选中后，按 filterEndpoint 反查允许的 target 集合
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
    apiClient
      .get<{ items: Array<Record<string, string>> }>(route(prefilter.filterEndpoint), {
        params: { [prefilter.filterParamKey]: prefilterSelected, pageSize: "10000" },
      })
      .then((res) => {
        const codes = new Set<string>();
        for (const r of res.data?.items ?? []) {
          const c = r[prefilter.filterResultKey];
          if (c) codes.add(String(c));
        }
        setAllowedTargetCodes(codes);
        setSelected(""); // 过滤集变了，target 选中清空
      })
      .catch(() => setError("加载过滤集合失败"));
  }, [prefilterSelected, prefilter?.filterEndpoint, prefilter?.filterParamKey, prefilter?.filterResultKey]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      [parentParam]: parentCode,
      [targetParam]: selected,
      ...extra,
    };
    try {
      const res = await apiClient.post(route(endpoint), payload);
      if (
        res.data &&
        typeof res.data === "object" &&
        "message" in (res.data as { message?: string })
      ) {
        setError((res.data as { message: string }).message);
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

  const remove = async (targetCode: string, row: Record<string, string>) => {
    setBusy(true);
    setError(null);
    const params: Record<string, string> = {
      [parentParam]: parentCode,
      [targetParam]: targetCode,
    };
    for (const f of extraFields) {
      const v = row[f.name];
      if (v !== undefined) params[f.name] = v;
    }
    try {
      await apiClient.delete(route(endpoint), { params });
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
        {rows.map((r) => {
          const code = r[targetParam] ?? '';
          // 行优先显示目标可读名称（如检测参数名），找不到再回退到 code
          const target = targets.find((t) => t[targetValueKey] === code);
          const display = target?.[targetTextKey] ?? code;
          const extraText = targetExtraTextKey ? target?.[targetExtraTextKey] : undefined;
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
                {showParameterObjects && (parameterObjectNames.get(code) ?? []).map((n) => ` · ${n}`).join("")}
                {extraFields
                  .filter((f) => !f.rowPrefix)
                  .map((f) => ` · ${f.label}: ${f.valueLabels?.[r[f.name] ?? ""] ?? r[f.name] ?? ""}`)
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
        })}
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
                <option key={o[prefilter.valueKey] ?? ""} value={o[prefilter.valueKey] ?? ""}>
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
              .filter((t) => !allowedTargetCodes || allowedTargetCodes.has(String(t[targetValueKey] ?? "")))
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
