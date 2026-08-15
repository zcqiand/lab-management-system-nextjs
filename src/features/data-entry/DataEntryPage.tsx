import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlowStagePage } from '../flow-pipeline/FlowStagePage'
import { ReportPreviewModal } from './ReportPreviewModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { apiClient, API_ROUTES } from '@/api/legacy-client'
import type {
  SampleReceipt,
  Sample,
  TestRecord,
  InspectionParameter,
  InspectionReportName,
} from '@/types/api'
import type { InspectionStandard } from '@/types/inspection/inspection-standard'
import type { InspectionStandardParameter } from '@/types/inspection/inspection-standard-parameter'
import type { InspectionTechnicalRequirement } from '@/types/inspection/inspection-technical-requirement'
import type { ExtFieldDef } from '@/types/common/ext-field-def'
import { resolveParamInterfaceModel } from './models/registry'
import { resolveInterfaceByParam } from './models/resolveInterfaceByParam'
import { strengthsFromRecordResult } from './models/rebar-mechanics'
import type { ParamInterfaceRow, ParamInterfaceLink } from '@/types/common'

/** 数据录入——流程线第三环节（flowStatus='data_entry'）。
 * 列表用 FlowStagePage；点「录入结果」打开双栏弹窗：左样品 / 右该样品全部检测参数平铺。
 * 录入检测结果 + 人工单项评定（verdict），POST/PUT /test-records。 */
function EntryRowAction({
  receipt,
  onEntry,
}: {
  receipt: SampleReceipt
  onEntry: (r: SampleReceipt) => void
}) {
  return (
    <button
      onClick={() => onEntry(receipt)}
      data-fn="M03.F03.I03"
      className="px-2 py-1 text-blue-600 hover:underline"
    >
      录入结果
    </button>
  )
}

type Verdict = '合格' | '不合格' | '符合' | '不符合'

/** 把技术要求结构渲染成可读文本，如「≥ 400 MPa」「28 ~ 32 MPa」。 */
function requirementLabel(r: InspectionTechnicalRequirement): string {
  const unit = r.unit ? ` ${r.unit}` : ''
  if (
    (r.valueType === 'range' || r.comparison === 'range') &&
    r.minValue != null &&
    r.maxValue != null
  ) {
    return `${r.minValue} ~ ${r.maxValue}${unit}`
  }
  if (r.comparison === '≥' && r.minValue != null) return `≥ ${r.minValue}${unit}`
  if (r.comparison === '≤' && r.maxValue != null) return `≤ ${r.maxValue}${unit}`
  if (r.targetValue)
    return `${r.comparison === '=' || r.comparison === 'eq' ? '= ' : ''}${r.targetValue}${unit}`
  if (r.expression) return r.expression
  const parts = [r.comparison, r.minValue ?? r.maxValue ?? r.targetValue]
    .filter(Boolean)
    .join(' ')
  return parts ? `${parts}${unit}` : r.remark || '—'
}

export function EntryModal({
  receipt,
  onClose,
}: {
  receipt: SampleReceipt
  onClose: () => void
}) {
  const [samples, setSamples] = useState<Sample[]>([])
  const [records, setRecords] = useState<TestRecord[]>([])
  const [parameters, setParameters] = useState<InspectionParameter[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Sample | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [overrideResult, setOverrideResult] = useState<'pass' | 'fail' | ''>('')
  const [overriding, setOverriding] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')
  // dirty 缓冲必须按 (sampleId, parameterCode) 联合键存——否则切换样品时
  // 前一样品的输入会被错误归到当前样品的 saveAll，导致跨样品数据串台。
  const [inputs, setInputs] = useState<Record<string, string>>({}) // key=`${sid}#${code}` -> 输入
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({}) // key=`${sid}#${code}` -> 改判
  const [bases, setBases] = useState<Record<string, string>>({}) // key=`${sid}#${code}` -> 检测依据 standardCode
  const [reqCodes, setReqCodes] = useState<Record<string, string>>({}) // key=`${sid}#${code}` -> 技术要求 id
  const [standards, setStandards] = useState<InspectionStandard[]>([])
  const [stdParams, setStdParams] = useState<InspectionStandardParameter[]>([])
  const [techReqs, setTechReqs] = useState<InspectionTechnicalRequirement[]>([])
  const [interfaces, setInterfaces] = useState<ParamInterfaceRow[]>([])
  const [links, setLinks] = useState<ParamInterfaceLink[]>([])
  const [category, setCategory] = useState<InspectionReportName | null>(null)
  const [calcRules, setCalcRules] = useState<
    Array<{ inspectionParameterCode: string; specimenCount: number; reportNameCode?: string }>
  >([])
  const [info, setInfo] = useState({
    testEnvironment: receipt.testEnvironment ?? '',
    mainEquipment: receipt.mainEquipment ?? '',
    testOperator: receipt.testOperator ?? '',
    originalRecordNo: receipt.originalRecordNo ?? '',
    testStartDate: receipt.testStartDate ?? '',
    testEndDate: receipt.testEndDate ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [sampRes, recRes, paramRes, stdRes, stdParamRes, reqRes, piRes, piLinkRes, calcRes] = await Promise.all([
        apiClient.get<{ items: Sample[] }>(API_ROUTES['/samples'], {
          params: { receiptId: receipt.id, page: 1, pageSize: 100 },
        }),
        apiClient.get<{ items: TestRecord[] }>(API_ROUTES['/test-records'], {
          params: { receiptId: receipt.id, page: 1, pageSize: 200 },
        }),
        apiClient.get<{ items: InspectionParameter[] }>(API_ROUTES['/inspection-parameters'], {
          // 全部参数一次拉齐（>500 条），否则接样单选中的高位编码参数(IP-0548..)被分页截断，录入卡缺失。
          params: { page: 1, pageSize: 1000 },
        }),
        apiClient.get<{ items: InspectionStandard[] }>(API_ROUTES['/inspection-standards'], {
          params: { page: 1, pageSize: 500 },
        }),
        apiClient.get<{ items: InspectionStandardParameter[] }>(
          API_ROUTES['/inspection-standard-parameters'],
          { params: { page: 1, pageSize: 500 } },
        ),
        apiClient.get<{ items: InspectionTechnicalRequirement[] }>(
          API_ROUTES['/inspection-technical-requirements'],
          { params: { page: 1, pageSize: 500 } },
        ),
        apiClient.get<{ items: ParamInterfaceRow[] }>(API_ROUTES['/param-interfaces'], {
          params: { page: 1, pageSize: 500 },
        }),
        apiClient.get<{ items: ParamInterfaceLink[] }>(
          API_ROUTES['/inspection-parameter-param-interfaces'],
          { params: { pageSize: 10000 } },
        ),
        apiClient.get<{ items: Array<{ inspectionParameterCode: string; specimenCount: number; reportNameCode?: string }> }>(
          API_ROUTES['/inspection-calculation-rules'],
          { params: { page: 1, pageSize: 500, reportNameCode: receipt.categoryCode ?? undefined } },
        ),
      ])
      const sampList = sampRes.data.items ?? []
      const recList = recRes.data.items ?? []
      let paramList = paramRes.data.items ?? []
      if (receipt.testParameters && receipt.testParameters.length > 0) {
        const allowed = new Set(receipt.testParameters)
        paramList = paramList.filter((p) => allowed.has(p.code))
      }
      // 报告类别（决定扩展属性 extFields + 类别名）单独 fetch：报告名称 list 太大，
      // 按 receipt.categoryCode 精确查一次即可。
      let cat: InspectionReportName | null = null
      try {
        const catRes = await apiClient.get<{ items: InspectionReportName[] }>(
          API_ROUTES['/report-names'],
          { params: { page: 1, pageSize: 500 } },
        )
        cat =
          catRes.data?.items?.find((r) => r.code === receipt.categoryCode) ?? null
      } catch {
        cat = null
      }
      setSamples(sampList)
      setRecords(recList)
      setParameters(paramList)
      setStandards(stdRes.data.items ?? [])
      setStdParams(stdParamRes.data.items ?? [])
      setTechReqs(reqRes.data.items ?? [])
      setInterfaces(piRes.data.items ?? [])
      setCategory(cat)
      setLinks(piLinkRes.data.items ?? [])
      setCalcRules(calcRes.data.items ?? [])
      setSelectedId((prev) => prev || (sampList[0]?.id ?? ''))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }, [receipt.id, receipt.testParameters, receipt.categoryCode])

  useEffect(() => {
    load()
  }, [load])

  const selectedSample = samples.find((s) => s.id === selectedId) ?? null

  // 当前样品的检测记录：parameterCode -> record
  const recordByParam = new Map<string, TestRecord>()
  records
    .filter((r) => r.sampleId === selectedId)
    .forEach((r) => recordByParam.set(r.parameterCode, r))

  // 检测依据 / 技术要求 候选项的查表索引
  const standardByCode = new Map(standards.map((s) => [s.code, s]))
  const reqByCode = new Map(techReqs.map((r) => [r.id, r]))

  // 参数 → 计算规则（取 specimenCount 驱动录入卡组数）。
  // 优先取 reportNameCode 匹配当前收样的规则；未匹配上回退到全局规则（reportNameCode 为空）。
  const calcRuleByParam = new Map<string, { specimenCount: number }>()
  for (const cr of calcRules) {
    const cur = calcRuleByParam.get(cr.inspectionParameterCode)
    if (!cur) {
      calcRuleByParam.set(cr.inspectionParameterCode, { specimenCount: cr.specimenCount })
      continue
    }
    // 已存的是全局、回退版本；遇到当前 reportNameCode 匹配的则覆盖
    if (cr.reportNameCode === receipt.categoryCode) {
      calcRuleByParam.set(cr.inspectionParameterCode, { specimenCount: cr.specimenCount })
    }
  }

  // 强屈比(IP-0559)/超强比(IP-0560) 跨记录联立：同样品 IP-0087 抗拉 + IP-0086 屈服 + 标准屈服值。
  const crossRecord = {
    tensileStrengths: strengthsFromRecordResult(recordByParam.get('IP-0087')?.result),
    yieldStrengths: strengthsFromRecordResult(recordByParam.get('IP-0086')?.result),
    specStandardYield: techReqs.find(
      (r) =>
        r.inspectionParameterCode === 'IP-0086' &&
        r.verificationStatus === 'verified' &&
        r.minValue != null,
    )?.minValue,
  }
  const RATIO_PARAMS = new Set(['IP-0559', 'IP-0560'])

  // 参数 → 界面组件派发表：未绑定的参数不在此表，由 registry fallback 到 DefaultParamCard。
  const interfaceByParam = useMemo(
    () => resolveInterfaceByParam(interfaces, links, receipt.categoryCode),
    [interfaces, links, receipt.categoryCode],
  )

  // 落库单个检测参数（依据 + 技术要求 + 结果 + 单项评定）。无既有记录且无任何输入时跳过，避免空记录。
  const persistParam = async (sid: string, paramCode: string) => {
    if (!selectedSample || selectedSample.id !== sid) return
    const k = `${sid}#${paramCode}`
    const existing = recordByParam.get(paramCode)
    const input = inputs[k] ?? existing?.result ?? ''
    const v = verdicts[k]
    const basisSel = bases[k]
    const reqSel = reqCodes[k]
    if (!existing && input === '' && !v && !basisSel && !reqSel) return
    const payload: Record<string, unknown> = {
      sampleId: sid,
      parameterCode: paramCode,
      result: input,
    }
    if (v) {
      payload.verdict = v
    }
    if (basisSel) {
      payload.standardCode = basisSel
    }
    if (reqSel) {
      const found = reqByCode.get(reqSel)
      payload.requirementCode = reqSel
      if (found) payload.requirement = requirementLabel(found)
    }
    let saved: TestRecord
    if (existing) {
      const res = await apiClient.put<TestRecord>(`${API_ROUTES['/test-records']}/${existing.id}`, payload)
      saved = res.data
    } else {
      const res = await apiClient.post<TestRecord>(API_ROUTES['/test-records'], payload)
      saved = res.data
    }
    setRecords((prev) => {
      const others = prev.filter(
        (r) =>
          !(r.sampleId === saved.sampleId && r.parameterCode === saved.parameterCode),
      )
      return [...others, saved]
    })
    // 落库后清掉该 (sampleId, paramCode) 的 dirty 缓冲；其他样品保留。
    setInputs((prev) => {
      const next = { ...prev }
      delete next[k]
      return next
    })
    setVerdicts((prev) => {
      const next = { ...prev }
      delete next[k]
      return next
    })
    setBases((prev) => {
      const next = { ...prev }
      delete next[k]
      return next
    })
    setReqCodes((prev) => {
      const next = { ...prev }
      delete next[k]
      return next
    })
  }

  // 模型卡上报的改动分派到 (sampleId, paramCode) 联合键 dirty 缓冲：
  // result/verdict/standardCode/requirementCode。
  // 联合键是必需的——单按 paramCode 会在切换样品时把上一份输入错误归到当前样品的 saveAll。
  // 默认卡 select 已带 code；requirement 文本由 persistParam 据 reqByCode 反查兜底。
  // 关联参数镜像：断后伸长率 IP-0150 与最大力总伸长率 IP-0097 是同一测量的两个口径，
  // 用户在 IP-0150 卡上录入 → 同步写到 IP-0097 的 dirty 缓冲 → saveAll 时一起落库。
  const MIRROR_PARAMS: Record<string, string> = {
    IP_0150: 'IP-0097', // 断后伸长率 → 最大力总伸长率
  }
  const applyPatch = (sid: string, paramCode: string, patch: Partial<TestRecord>) => {
    const k = `${sid}#${paramCode}`
    if (patch.result !== undefined) {
      const v = patch.result
      setInputs((prev) => ({ ...prev, [k]: v }))
    }
    if (patch.verdict !== undefined) {
      const v = patch.verdict as Verdict
      setVerdicts((prev) => ({ ...prev, [k]: v }))
    }
    if (patch.standardCode !== undefined) {
      const v = patch.standardCode
      setBases((prev) => ({ ...prev, [k]: v }))
    }
    if (patch.requirementCode !== undefined) {
      const v = patch.requirementCode
      setReqCodes((prev) => ({ ...prev, [k]: v }))
    }
    // 镜像：把 result 同步到关联参数
    const mirror = MIRROR_PARAMS[paramCode.replace(/-/g, '_')]
    if (mirror && patch.result !== undefined) {
      const mk = `${sid}#${mirror}`
      setInputs((prev) => ({ ...prev, [mk]: patch.result as string }))
    }
  }

  // 统一保存：检测信息（接样单）+ 当前样品下所有改动的检测项。供底部「保存」按钮调用。
  // 关键：dirty 判定只算「当前 selectedId」的复合键——其他样品的输入保留不被串台。
  const saveAll = async () => {
    if (!selectedSample) return
    const sid = selectedSample.id
    setSaving(true)
    setError(null)
    try {
      await apiClient.put(`${API_ROUTES['/receipts']}/${receipt.id}`, info)
      const dirty = parameters.filter((p) => {
        const k = `${sid}#${p.code}`
        return (
          inputs[k] !== undefined ||
          verdicts[k] !== undefined ||
          bases[k] !== undefined ||
          reqCodes[k] !== undefined
        )
      })
      await Promise.all(dirty.map((p) => persistParam(sid, p.code)))
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message
      setError(msg ?? (e instanceof Error ? e.message : '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  // I04 检测项删除：DELETE /samples/:id → 删本地 samples + 级联删 records + 清 dirty
  const handleDeleteSample = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`${API_ROUTES['/samples']}/${deleteTarget.id}`)
      setSamples((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setRecords((prev) => prev.filter((r) => r.sampleId !== deleteTarget.id))
      // 清空与该样品相关的 dirty 缓冲
      const prefix = `${deleteTarget.id}#`
      setInputs((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))))
      setVerdicts((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))))
      setBases((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))))
      setReqCodes((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))))
      if (selectedId === deleteTarget.id) setSelectedId('')
      setDeleteTarget(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // I06 人工改判：PUT /receipts/:id { result: 'pass'|'fail' } → 改判定结果
  const handleOverride = async () => {
    if (!overrideResult) return
    setOverriding(true)
    try {
      const updated = await apiClient.put(`${API_ROUTES['/receipts']}/${receipt.id}`, { result: overrideResult })
      // 触发上层 refetch —— 这里通过 receipt onClose 让上游重新 fetch
      setOverrideResult('')
      // 立即更新显示
      onClose()
      // 上层可通过弹窗方式重新打开；这里用 window.dispatchEvent 触发 refetch
      window.dispatchEvent(new CustomEvent('receipt:updated', { detail: updated.data }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '改判失败')
    } finally {
      setOverriding(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[94vh] flex flex-col">
        <header className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-base font-semibold">
            录入检测结果 — {receipt.commissionCode}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </header>

        {error && <div className="px-5 py-2 text-sm text-red-600 bg-red-50">{error}</div>}

        <div className="flex flex-1 overflow-hidden">
          {/* 左栏：样品列表 */}
          <div className="w-44 border-r overflow-y-auto p-2 space-y-1">
            {samples.length === 0 && (
              <p className="text-xs text-gray-400 p-2">暂无样品</p>
            )}
            {samples.map((s) => {
              const hasEntry = records.some((r) => r.sampleId === s.id)
              const selected = s.id === selectedId
              return (
                <div key={s.id} className="relative group">
                  <button
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs border ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : hasEntry
                          ? 'bg-green-50 border-green-200'
                          : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="font-medium truncate">{s.sampleCode ?? '(未编号)'}</div>
                    {!hasEntry && !selected && (
                      <span className="text-orange-500">未录入</span>
                    )}
                  </button>
                  <button
                    // @entry M03.F03.I04 检测项删除（侧栏样品卡右上角「×」按钮 → DELETE /samples/:id）
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(s)
                    }}
                    data-fn="M03.F03.I04"
                    title={`删除样品 ${s.sampleCode ?? s.id}`}
                    className="absolute top-0.5 right-0.5 px-1 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>

          {/* 右栏：选中样品的全部检测参数平铺 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!selectedSample && <p className="text-sm text-gray-400">请选择左侧样品</p>}
            {selectedSample && (
              <>
                <div className="text-xs text-gray-500 leading-relaxed">
                  当前样品：<b>{selectedSample.sampleCode ?? '—'}</b>
                  {selectedSample.sampleName && ` / ${selectedSample.sampleName}`}
                  {selectedSample.brand && ` / 牌号 ${selectedSample.brand}`}
                  {selectedSample.model && ` / 型号 ${selectedSample.model}`}
                  {selectedSample.specification &&
                    ` / 规格 ${selectedSample.specification}`}
                  {selectedSample.grade && ` / 等级 ${selectedSample.grade}`}
                  {selectedSample.manufacturer && ` / 厂家 ${selectedSample.manufacturer}`}
                  {selectedSample.structuralPart && ` / 部位 ${selectedSample.structuralPart}`}
                  {selectedSample.representQuantity &&
                    ` / 代表数量 ${selectedSample.representQuantity}`}
                  {selectedSample.sampleQuantity &&
                    ` / 样品数量 ${selectedSample.sampleQuantity}`}
                  {selectedSample.batchNumber && ` / 批号 ${selectedSample.batchNumber}`}
                  {selectedSample.supplyUnit && ` / 供销 ${selectedSample.supplyUnit}`}
                  {selectedSample.arrivalDate && ` / 进场 ${selectedSample.arrivalDate}`}
                  {selectedSample.samplingDate && ` / 取样 ${selectedSample.samplingDate}`}
                  {selectedSample.curingCondition &&
                    ` / 养护 ${selectedSample.curingCondition}`}
                  {selectedSample.age && ` / 龄期 ${selectedSample.age}`}
                  {selectedSample.remark && ` / 备注 ${selectedSample.remark}`}
                  {/* 扩展属性（按 InspectionReportName.extFields 顺序显示） */}
                  {category?.extFields?.map((f: ExtFieldDef) => {
                    const v = selectedSample.ext?.[f.key]
                    if (!v) return null
                    return ` / ${f.label} ${v}`
                  })}
                </div>
                {parameters.length === 0 && (
                  <p className="text-sm text-gray-400">
                    无可录入的检测参数（接样单未关联参数）
                  </p>
                )}
                {parameters.map((p) => {
                  const rec = recordByParam.get(p.code)
                    const ifce = interfaceByParam[p.code]
                    const Model = resolveParamInterfaceModel(ifce?.componentPath)
                    const basisOptions = stdParams
                      .filter((sp) => sp.inspectionParameterCode === p.code)
                      .map((sp) => standardByCode.get(sp.inspectionStandardCode))
                      .filter((s): s is InspectionStandard => !!s)
                    const reqOptions = techReqs.filter(
                      (r) => r.inspectionParameterCode === p.code,
                    )
                    return (
                      <div key={p.code}>
                        <Model
                          parameter={p}
                          record={rec}
                          sampleId={selectedSample.id}
                          standards={basisOptions}
                          stdParams={stdParams}
                          techReqs={reqOptions}
                          config={ifce?.config}
                          calcRule={calcRuleByParam.get(p.code)}
                          crossRecord={RATIO_PARAMS.has(p.code) ? crossRecord : undefined}
                          onChange={(patch) => applyPatch(selectedSample.id, p.code, patch)}
                        />
                      </div>
                    )
                  })
                }
              </>
            )}
          </div>
        </div>

        <footer className="border-t bg-gray-50">
          <div className="px-5 py-3 grid grid-cols-3 gap-3 text-xs border-b">
            {(
              [
                { k: 'testEnvironment', label: '检测环境' },
                { k: 'mainEquipment', label: '主要设备' },
                { k: 'testOperator', label: '检测人员' },
                { k: 'originalRecordNo', label: '原始记录单号' },
                { k: 'testStartDate', label: '开始日期' },
                { k: 'testEndDate', label: '结束日期' },
              ] as const
            ).map(({ k, label }) => (
              <div key={k}>
                <label className="block text-gray-600 mb-0.5">{label}</label>
                <input
                  value={info[k]}
                  onChange={(e) => setInfo((prev) => ({ ...prev, [k]: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-3">
          <span className="text-xs text-gray-500">
            已录入 {records.length} 项；接样单整体结论：
            {receipt.result === 'pass'
              ? '合格'
              : receipt.result === 'fail'
                ? '不合格'
                : '—'}
          </span>
          <div className="flex items-center gap-2 mr-auto ml-4">
            <select
              // @entry M03.F03.I06 人工改判（footer 改判 select + 应用按钮）
              value={overrideResult}
              onChange={(e) => setOverrideResult(e.target.value as 'pass' | 'fail' | '')}
              data-fn="M03.F03.I06"
              className="border rounded px-2 py-1 text-xs"
            >
              <option value="">改判...</option>
              <option value="pass">合格</option>
              <option value="fail">不合格</option>
            </select>
            <button
              onClick={handleOverride}
              disabled={!overrideResult || overriding}
              className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-100"
            >
              {overriding ? '改判中...' : '应用改判'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="px-4 py-1.5 text-sm border rounded hover:bg-gray-100"
            >
              报告预览
            </button>
            <button
              // @entry M03.F03.I02 检测数据保存（footer「保存」按钮 → saveAll → sampleStore.createSample/updateSample）
              onClick={saveAll}
              disabled={saving}
              data-fn="M03.F03.I02"
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm border rounded hover:bg-gray-100"
            >
              关闭
            </button>
          </div>
          </div>
        </footer>
      </div>
    </div>
    {previewOpen && (
      <ReportPreviewModal
        open
        receipt={receipt}
        onClose={() => setPreviewOpen(false)}
      />
    )}
    <ConfirmModal
      open={deleteTarget !== null}
      title={`删除样品 — ${deleteTarget?.sampleCode ?? ''}`}
      danger
      message={
        <div className="text-sm">
          <p>确定删除该样品及其全部检测项？</p>
          <p className="text-xs text-gray-500 mt-2">级联删除 {records.filter((r) => r.sampleId === deleteTarget?.id).length} 条 testRecord。</p>
        </div>
      }
      confirmText="删除"
      loading={deleting}
      onConfirm={handleDeleteSample}
      onCancel={() => setDeleteTarget(null)}
    />
    </>
  )
}

export function DataEntryPage() {
  const [entryTarget, setEntryTarget] = useState<SampleReceipt | null>(null)

  const rowAction = useCallback(
    (r: SampleReceipt) => <EntryRowAction receipt={r} onEntry={setEntryTarget} />,
    [],
  )

  return (
    // @entry M03.F03.I01
    // @entry M03.F03.I07
    <>
      <FlowStagePage
        title="数据录入"
        stage="data_entry"
        subtitle="录入各样品各项检测参数的检测结果，并人工评定单项合格/不合格"
        submitLabel="提交审核"
        canReturn
        dataFn="M03.F03.I01"
        filterDataFn="M03.F03.I07"
        rowActions={rowAction}
      />
      {entryTarget && (
        <EntryModal receipt={entryTarget} onClose={() => setEntryTarget(null)} />
      )}
    </>
  )
}

export default DataEntryPage
