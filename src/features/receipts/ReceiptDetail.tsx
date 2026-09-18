import { useCallback, useEffect, useState } from 'react'
import type {
  InspectionParameter as TestParameter,
  InspectionStandard,
  ParamInterface as ParamInterfaceRow,
  ParamInterfaceLink,
  StandardParameterLink as InspectionStandardParameter,
  TestRecordsListTestRecordsParams,
} from '@/api/endpoints/model'
import type { TechnicalRequirementRow as InspectionTechnicalRequirement } from '@/features/data-entry/models/types'
import {
  inspectionDictionaryListParameters,
  inspectionDictionaryListStandardParameterLinks,
  inspectionDictionaryListStandards,
} from '@/api/endpoints/inspection-dictionary/inspection-dictionary'
import {
  paramInterfacesListParamInterfaceLinks,
  paramInterfacesListParamInterfaces,
} from '@/api/endpoints/param-interfaces/param-interfaces'
import { reportNamesListReportNames } from '@/api/endpoints/report-names/report-names'
import { receiptsGetReceipt } from '@/api/endpoints/receipts/receipts'
import { samplesListSamples } from '@/api/endpoints/samples/samples'
import { technicalRequirementsListTechnicalRequirements } from '@/api/endpoints/technical-requirements/technical-requirements'
import { testRecordsListTestRecords } from '@/api/endpoints/test-records/test-records'
import { resolveInterfaceByParam } from '@/features/data-entry/models/resolveInterfaceByParam'
import { resolveParamInterfaceModel } from '@/features/data-entry/models/registry'
import generatedParameters from '@/data/generated/inspection-parameter.json'

interface ExtField { key: string; label: string }

interface TestRecord {
  id: string
  // 契约 TestRecord.tenantId 必填（orval 生成物），本地下游 Model 卡直接消费
  tenantId: string
  sampleId: string
  parameterCode: string
  requirementCode?: string
  requirement: string
  result: string
  verdict?: string
  standardCode?: string
  createdAt: string
  updatedAt: string
}

interface Sample {
  id: string
  sampleCode?: string
  sampleName?: string
  materialType?: string
  specification?: string
  grade?: string
  model?: string
  brand?: string
  manufacturer?: string
  structuralPart?: string
  representQuantity?: string
  sampleQuantity?: string
  batchNumber?: string
  supplyUnit?: string
  arrivalDate?: string
  samplingDate?: string
  curingCondition?: string
  age?: string
  remark?: string
  ext?: Record<string, string>
  status?: string
}

interface ReceiptDetailProps {
  receiptId: string
  categoryCode: string
}

export function ReceiptDetail({ receiptId, categoryCode }: ReceiptDetailProps) {
  const [samples, setSamples] = useState<Sample[]>([])
  const [testItems, setTestRecords] = useState<TestRecord[]>([])
  const [parameters, setParameters] = useState<TestParameter[]>([])
  const [standards, setStandards] = useState<InspectionStandard[]>([])
  const [stdParams, setStdParams] = useState<InspectionStandardParameter[]>([])
  const [techReqs, setTechReqs] = useState<InspectionTechnicalRequirement[]>([])
  const [interfaces, setInterfaces] = useState<ParamInterfaceRow[]>([])
  const [links, setLinks] = useState<ParamInterfaceLink[]>([])
  const [extFields, setExtFields] = useState<ExtField[]>([])
  const [testParameterCodes, setTestParameterCodes] = useState<string[] | null>(null)
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // test-records 契约参数集无 receiptId（spec gap，后端 /api/test-records 支持），
      // 用交叉类型变量透传，避免 TS 多余属性检查。
      const testRecordParams: TestRecordsListTestRecordsParams & { receiptId?: string } = {
        receiptId,
        page: 1,
        pageSize: 500,
      }
      const [sRes, tiRes, pRes, stdRes, stdParamRes, reqRes, piRes, piLinkRes, catRes, recRes] = await Promise.all([
        samplesListSamples({ receiptId, page: 1, pageSize: 200 }),
        testRecordsListTestRecords(testRecordParams),
        inspectionDictionaryListParameters({ page: 1, pageSize: 1000 }),
        inspectionDictionaryListStandards({ page: 1, pageSize: 500 }),
        inspectionDictionaryListStandardParameterLinks(),
        technicalRequirementsListTechnicalRequirements(),
        paramInterfacesListParamInterfaces({ page: 1, pageSize: 500 }),
        paramInterfacesListParamInterfaceLinks(),
        reportNamesListReportNames({ page: 1, pageSize: 200 }),
        receiptsGetReceipt(receiptId),
      ])
      const sItems: Sample[] = sRes.items ?? []
      const tiItems: TestRecord[] = tiRes.items ?? []
      setSamples(sItems)
      setTestRecords(tiItems)
      setParameters(pRes.items ?? [])
      setStandards(stdRes.items ?? [])
      setStdParams(stdParamRes.items ?? [])
      // technical-requirements list 按 SSOT 是裸数组（不分页）。
      setTechReqs((Array.isArray(reqRes) ? reqRes : []) as unknown as InspectionTechnicalRequirement[])
      setInterfaces(piRes.items ?? [])
      setLinks(piLinkRes.items ?? [])
      setExtFields(catRes.items?.find((r) => r.code === categoryCode)?.extFields ?? [])
      // 接样单显式声明的检测参数集合——为空时回退到全部 test-records（旧数据兼容）。
      setTestParameterCodes(recRes?.testParameters ?? null)
      if (sItems.length > 0 && !activeSampleId) {
        setActiveSampleId(sItems[0]!.id)
      }
    } catch {
      setExtFields([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeSampleId 仅为初始选中态，不参与数据获取
  }, [receiptId, categoryCode])

  useEffect(() => { fetchData() }, [fetchData])

  const activeSample = samples.find((s) => s.id === activeSampleId)
  const activeItems = testItems
    .filter((i) => i.sampleId === activeSampleId)
    .filter(
      (i) =>
        testParameterCodes === null ||
        testParameterCodes.length === 0 ||
        testParameterCodes.includes(i.parameterCode),
    )

  // 参数 → 界面组件派发表（按报告作用域；白名单之外的参数走 default 4 格卡）
  const interfaceByParam = resolveInterfaceByParam(interfaces, links, categoryCode)

  return (
    <div className="bg-white rounded shadow p-4 space-y-3">
      {samples.length > 0 && (
        <div className="flex border-b text-sm overflow-x-auto">
          {samples.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSampleId(s.id)}
              className={`px-4 py-2 whitespace-nowrap border-b-2 ${s.id === activeSampleId ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {s.sampleCode ?? s.sampleName ?? s.id}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 py-4 text-center">加载中...</p>}
      {error && <p role="alert" className="text-sm text-red-600 py-2">{error}</p>}

      {activeSample && (
        <>
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">样品信息</h4>
            <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-sm">
              {/* 基本信息 */}
              <div><span className="text-gray-500">样品编号：</span>{activeSample.sampleCode ?? '—'}</div>
              <div><span className="text-gray-500">样品名称：</span>{activeSample.sampleName ?? '—'}</div>
              {/* 规格信息 */}
              <div><span className="text-gray-500">型号：</span>{activeSample.model ?? '—'}</div>
              <div><span className="text-gray-500">规格：</span>{activeSample.specification ?? '—'}</div>
              <div><span className="text-gray-500">等级：</span>{activeSample.grade ?? '—'}</div>
              <div><span className="text-gray-500">牌号：</span>{activeSample.brand ?? '—'}</div>
              {/* 生产信息 */}
              <div><span className="text-gray-500">出厂编号/批号：</span>{activeSample.batchNumber ?? '—'}</div>
              <div><span className="text-gray-500">生产厂家/产地：</span>{activeSample.manufacturer ?? '—'}</div>
              <div><span className="text-gray-500">供销单位：</span>{activeSample.supplyUnit ?? '—'}</div>
              <div><span className="text-gray-500">进场日期：</span>{activeSample.arrivalDate ?? '—'}</div>
              {/* 施工信息 */}
              <div><span className="text-gray-500">结构部位：</span>{activeSample.structuralPart ?? '—'}</div>
              <div><span className="text-gray-500">取（制）样日期：</span>{activeSample.samplingDate ?? '—'}</div>
              <div><span className="text-gray-500">养护条件：</span>{activeSample.curingCondition ?? '—'}</div>
              <div><span className="text-gray-500">龄期：</span>{activeSample.age ?? '—'}</div>
              {/* 数量 */}
              <div><span className="text-gray-500">代表数量：</span>{activeSample.representQuantity ?? '—'}</div>
              <div><span className="text-gray-500">样品数量：</span>{activeSample.sampleQuantity ?? '—'}</div>
              {/* 备注 */}
              {activeSample.remark && <div className="col-span-4"><span className="text-gray-500">备注：</span>{activeSample.remark}</div>}
            </div>
            {/* 扩展属性 */}
            {extFields.length > 0 && (
              <div className="mt-2 pt-2 border-t grid grid-cols-4 gap-x-4 gap-y-1 text-sm">
                {extFields.map(f => (
                  <div key={f.key}>
                    <span className="text-gray-500">{f.label}：</span>{activeSample.ext?.[f.key] ?? '—'}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">检测数据</h4>
            {activeItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">暂无检测数据</p>
            ) : (
              <div className="space-y-3">
                {activeItems.map((rec) => {
                  // 优先用 /inspection-parameters 的结果（已按 receipt.testParameters 过滤后）；
                  // 兜底用 generatedParameters（dev 服务偶发遗漏 seed master data 时仍能渲染）
                  let p = parameters.find((x) => x.code === rec.parameterCode)
                  if (!p) {
                    p = (generatedParameters as Array<{ code: string; name: string; canonicalName?: string; unit?: string }>).find(
                      (x) => x.code === rec.parameterCode,
                    ) as TestParameter | undefined
                  }
                  if (!p) return null
                  const ifce = interfaceByParam[rec.parameterCode]
                  const Model = resolveParamInterfaceModel(ifce?.componentPath)
                  // 按参数范围过滤候选项（和录入弹窗一致：每参数一份）
                  const basisOptions = stdParams
                    .filter((sp) => sp.inspectionParameterCode === rec.parameterCode)
                    .map((sp) => standards.find((s) => s.code === sp.inspectionStandardCode))
                    .filter((s): s is InspectionStandard => !!s)
                  const reqOptions = techReqs.filter(
                    (r) => r.inspectionParameterCode === rec.parameterCode,
                  )
                  return (
                    <div key={rec.id}>
                      {/* 详情页只读：onChange 设为 no-op，模型卡用 rec/standards/techReqs 渲染只读视图 */}
                      <Model
                        parameter={p}
                        record={rec}
                        sampleId={activeSample.id}
                        standards={basisOptions}
                        stdParams={stdParams}
                        techReqs={reqOptions}
                        config={ifce?.config}
                        onChange={() => {
                          /* 只读模式：忽略改动 */
                        }}
                        readOnly
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ReceiptDetail
