"use client";
// REF src/features/inspection-capability/InspectionCapabilityFormModal.tsx 移植。
// 差异：apiClient → @/api/legacy-client；REF 字面路由经 API_ROUTES 映射到
// lab-msw OpenAPI 路由（junction 端点从 /inspection-*-objects 等改为 /api/inspection/links/*）。
import { useEffect, useState } from "react";
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import { AssociationManager } from "./AssociationManager";

type Resource = "specialties" | "objects" | "parameters" | "standards";

const TITLES: Record<Resource, string> = {
  specialties: "新建检测专项",
  objects: "新建检测项目",
  parameters: "新建检测参数",
  standards: "新建检测标准",
};

const EDIT_TITLES: Record<Resource, string> = {
  specialties: "编辑检测专项",
  objects: "编辑检测项目",
  parameters: "编辑检测参数",
  standards: "编辑检测标准",
};

/** REF PATHS 键 → lab-msw 路由（API_ROUTES 查表；键集合封闭，必有命中）。 */
const ROUTES: Record<Resource, string> = {
  specialties: API_ROUTES["/inspection-specialties"],
  objects: API_ROUTES["/inspection-objects"],
  parameters: API_ROUTES["/inspection-parameters"],
  standards: API_ROUTES["/inspection-standards"],
};

type FieldType = "text" | "number" | "select" | "checkbox" | "aliases";
interface Field {
  name: string;
  label: string;
  type?: FieldType; // 缺省 text
  options?: string[]; // select 用
  required?: boolean;
  placeholder?: string;
  default?: boolean; // checkbox 新建态默认值（缺省 false）
}

const FIELDS: Record<Resource, Field[]> = {
  specialties: [
    { name: "code", label: "编码", required: true, placeholder: "SP10" },
    { name: "officialNo", label: "官方序号", placeholder: "十" },
    { name: "name", label: "名称", required: true },
    { name: "isOfficial", label: "官方", type: "checkbox" },
    { name: "enabled", label: "启用", type: "checkbox", default: true },
    { name: "sortOrder", label: "排序", type: "number", placeholder: "999" },
  ],
  objects: [
    { name: "code", label: "编码", required: true, placeholder: "OBJ-SP01-P24" },
    {
      name: "inspectionSpecialtyCode",
      label: "检测专项编码",
      required: true,
      placeholder: "SP01",
    },
    { name: "sourceProjectNo", label: "来源行号", placeholder: "24" },
    { name: "sourceProjectName", label: "来源行名称", placeholder: "自定义项目" },
    { name: "name", label: "名称", required: true },
    { name: "isOptionalForQualification", label: "资质可选", type: "checkbox" },
    { name: "isOfficial", label: "官方", type: "checkbox" },
    { name: "enabled", label: "启用", type: "checkbox", default: true },
    { name: "sortOrder", label: "排序", type: "number", placeholder: "999" },
  ],
  parameters: [
    { name: "code", label: "编码", required: true, placeholder: "IP-CUSTOM-1" },
    { name: "name", label: "名称", required: true },
    { name: "rawName", label: "原始名" },
    { name: "canonicalName", label: "规范名" },
    { name: "methodText", label: "试验方法" },
    { name: "aliases", label: "别名（逗号分隔）", type: "aliases" },
    { name: "unit", label: "单位", placeholder: "MPa" },
    {
      name: "sourceType",
      label: "来源类型",
      type: "select",
      options: ["official", "custom"],
    },
    { name: "sortOrder", label: "排序", type: "number", placeholder: "999" },
  ],
  standards: [
    { name: "code", label: "编码", required: true, placeholder: "GB/T CUSTOM-2026" },
    { name: "name", label: "名称", required: true },
    { name: "version", label: "版本", placeholder: "2026" },
    {
      name: "status",
      label: "状态",
      type: "select",
      options: ["active", "superseded", "draft"],
    },
    { name: "sourceDocumentId", label: "来源文件" },
    { name: "sortOrder", label: "排序", type: "number", placeholder: "999" },
  ],
};

interface Props {
  resource: Resource;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: { id: string; [k: string]: unknown } | null;
}

type TabKey = "basic" | "assocObject" | "assocStandard" | "assocParameter";

// 编辑态可用页签：基本信息 + 该资源可维护的关联；新建态仅 basic
const ASSOC_TABS: Record<Resource, Array<{ key: TabKey; label: string }>> = {
  specialties: [
    { key: "basic", label: "基本信息" },
    { key: "assocObject", label: "关联检测项目" },
  ],
  objects: [
    { key: "basic", label: "基本信息" },
    { key: "assocStandard", label: "关联检测标准" },
    { key: "assocParameter", label: "关联检测参数" },
  ],
  parameters: [{ key: "basic", label: "基本信息" }],
  standards: [
    { key: "basic", label: "基本信息" },
    { key: "assocParameter", label: "关联检测参数" },
  ],
};

export function InspectionCapabilityFormModal({
  resource,
  open,
  onClose,
  onSaved,
  editing = null,
}: Props) {
  const fields = FIELDS[resource];
  const initialValues: Record<string, string> = {};
  for (const f of fields) {
    const ftype = f.type ?? "text";
    if (ftype === "checkbox") initialValues[f.name] = f.default ? "true" : "false";
    else initialValues[f.name] = "";
  }
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(open);
  const [tab, setTab] = useState<TabKey>("basic");

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      for (const f of fields) {
        const v = editing ? (editing as Record<string, unknown>)[f.name] : "";
        if (f.type === "checkbox") {
          // 编辑态取现值；新建态取字段默认值（缺省 false）
          if (editing) init[f.name] = v === true || v === "true" ? "true" : "false";
          else init[f.name] = f.default ? "true" : "false";
        } else if (f.type === "aliases")
          init[f.name] = Array.isArray(v) ? (v as string[]).join(", ") : "";
        else init[f.name] = v == null ? "" : String(v);
      }
      setValues(init);
      setError(null);
      setTab("basic");
      setInternalOpen(true);
    } else {
      setInternalOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resource, editing]);

  if (!internalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name] ?? "";
      if (f.type === "checkbox") payload[f.name] = v === "true";
      else if (f.type === "number")
        payload[f.name] = v === "" || v == null ? undefined : Number(v);
      else if (f.type === "aliases")
        payload[f.name] = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      else payload[f.name] = v;
    }
    // 保留原有 resource 专属默认值逻辑（objects/specialties/parameters/standards 的 isOfficial/enabled/sourceType/status 等）
    if (resource === "objects") {
      payload.isOfficial = payload.isOfficial ?? false;
      payload.isOptionalForQualification = payload.isOptionalForQualification ?? false;
      payload.enabled = payload.enabled ?? true;
    } else if (resource === "specialties") {
      payload.isOfficial = payload.isOfficial ?? false;
      payload.enabled = payload.enabled ?? true;
    } else if (resource === "parameters") {
      payload.rawName =
        (payload.rawName as string) ||
        (payload.name as string) ||
        (payload.canonicalName as string);
      payload.sourceType = payload.sourceType ?? "custom";
    } else if (resource === "standards") {
      payload.status = payload.status ?? "active";
    }
    try {
      const res = editing
        ? await apiClient.put(`${ROUTES[resource]}/${editing.id}`, payload)
        : await apiClient.post(ROUTES[resource], payload);
      if (!res.data || typeof res.data !== "object") {
        setError("服务端返回异常");
      } else if ("message" in (res.data as { message?: string })) {
        setError((res.data as { message: string }).message);
      } else {
        onSaved();
        onClose();
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "保存失败";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto"
      >
        <h3 className="text-lg font-semibold">
          {editing ? EDIT_TITLES[resource] : TITLES[resource]}
        </h3>
        {error && (
          <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        {editing && (
          <div className="flex gap-2 border-b" role="tablist">
            {ASSOC_TABS[resource].map((t) => (
              <button
                key={t.key}
                type="button"
                aria-label={t.label}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-sm ${
                  tab === t.key
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {(!editing || tab === "basic") && (
          <div className="space-y-3">
            {fields.map((f) => {
              const ftype = f.type ?? "text";
              if (ftype === "checkbox") {
                return (
                  <label key={f.name} className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={f.label}
                      checked={values[f.name] === "true"}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [f.name]: e.target.checked ? "true" : "false",
                        })
                      }
                      disabled={!!editing && f.name === "code"}
                    />
                    <span className="text-xs font-medium text-gray-600">{f.label}</span>
                  </label>
                );
              }
              if (ftype === "select") {
                return (
                  <label key={f.name} className="block text-sm">
                    <span className="text-xs font-medium text-gray-600">{f.label}</span>
                    <select
                      aria-label={f.label}
                      value={values[f.name] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.name]: e.target.value })
                      }
                      className="mt-1 w-full border rounded px-2 py-1.5"
                    >
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              // text / aliases 共用 input
              return (
                <label key={f.name} className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  <input
                    aria-label={f.label}
                    type={f.type === "number" ? "number" : "text"}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    placeholder={f.placeholder}
                    className="mt-1 w-full border rounded px-2 py-1.5"
                    required={f.required}
                    disabled={!!editing && f.name === "code"}
                  />
                </label>
              );
            })}
          </div>
        )}
        {editing && tab === "assocObject" && resource === "specialties" && (
          // @entry M06.F02.I07 关联检测专项（专项↔项目多对多）
          <AssociationManager
            ariaLabel="关联检测项目"
            endpoint="/inspection-specialty-objects"
            parentParam="inspectionSpecialtyCode"
            parentCode={String((editing as Record<string, unknown>).code ?? "")}
            targetLabel="检测项目"
            targetEndpoint="/inspection-objects"
            targetParam="inspectionObjectCode"
            targetValueKey="code"
            targetTextKey="name"
            fnId="M06.F02.I07"
          />
        )}
        {editing && tab === "assocStandard" && resource === "objects" && (
          // @entry M06.F02.I04 关联检测依据(role=TESTING) / @entry M06.F02.I05 关联判定依据(role=JUDGMENT)
          <AssociationManager
            ariaLabel="关联检测标准"
            endpoint="/inspection-object-standards"
            parentParam="inspectionObjectCode"
            parentCode={String((editing as Record<string, unknown>).code ?? "")}
            targetLabel="检测标准"
            targetEndpoint="/inspection-standards"
            targetParam="inspectionStandardCode"
            targetValueKey="code"
            targetTextKey="name"
            extraFields={[
              {
                name: "role",
                label: "标准性质",
                type: "select",
                options: ["TESTING", "JUDGMENT"],
                valueLabels: { TESTING: "检测依据", JUDGMENT: "判定依据" },
                rowPrefix: { TESTING: "【检测依据】", JUDGMENT: "【判定依据】" },
              },
            ]}
            fnId="M06.F02.I04"
          />
        )}
        {editing && tab === "assocParameter" && resource === "objects" && (
          // @entry M06.F02.I06 关联检测参数（项目↔参数多对多，含资质级别）
          // prefilter 设计：项目上下文天然按 inspectionObjectCode 过滤参数列表，与"先选检测项目→过滤参数"等效；
          // 故未启用组件层 prefilter。详见 REQ-2026-011 §「没把握的地方」#5。
          <AssociationManager
            ariaLabel="关联检测参数"
            endpoint="/inspection-object-parameters"
            parentParam="inspectionObjectCode"
            parentCode={String((editing as Record<string, unknown>).code ?? "")}
            targetLabel="检测参数"
            targetEndpoint="/inspection-parameters"
            targetParam="inspectionParameterCode"
            targetValueKey="code"
            targetTextKey="name"
            extraFields={[
              {
                name: "qualificationLevel",
                label: "资质级别",
                type: "select",
                options: ["QUALIFIED", "RESTRICTED"],
                valueLabels: { QUALIFIED: "必备", RESTRICTED: "可选" },
                rowPrefix: { QUALIFIED: "*", RESTRICTED: "" },
              },
            ]}
            fnId="M06.F02.I06"
          />
        )}
        {editing && tab === "assocParameter" && resource === "standards" && (
          // @entry M06.F04.I04 检测标准-检测参数关联（prefilter：先选检测项目→过滤参数，UX 见 REQ-2026-011）
          <AssociationManager
            ariaLabel="关联检测参数"
            endpoint="/inspection-standard-parameters"
            parentParam="inspectionStandardCode"
            parentCode={String((editing as Record<string, unknown>).code ?? "")}
            targetLabel="检测参数"
            targetEndpoint="/inspection-parameters"
            targetParam="inspectionParameterCode"
            targetValueKey="code"
            targetTextKey="name"
            prefilter={{
              label: "检测项目",
              endpoint: "/inspection-objects",
              valueKey: "code",
              textKey: "name",
              filterEndpoint: "/inspection-object-parameters",
              filterParamKey: "inspectionObjectCode",
              filterResultKey: "inspectionParameterCode",
            }}
            fnId="M06.F04.I04"
          />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default InspectionCapabilityFormModal;
