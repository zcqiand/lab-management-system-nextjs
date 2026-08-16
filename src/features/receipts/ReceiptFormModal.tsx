import { useEffect, useState, type FormEvent } from 'react'
import { apiClient, API_ROUTES } from '@/api/legacy-client'
import { useAuthStore } from '@/state/authStore'
import { SampleManagerModal } from '@/features/samples/SampleManagerModal'
import type {
  Contract,
  SampleReceipt,
  InspectionParameter,
  InspectionReportName,
} from '@/types/api'
import type { InspectionStandard } from '@/types/inspection/inspection-standard'

/** 接样表单提交值。categoryCode = 报告名称 code（FK→InspectionReportName.code）。 */
export interface ReceiptFormValues {
  id?: string
  contractId: string
  categoryCode: string
  commissionCode: string
  commissionDate: string
  projectName: string
  clientUnit: string
  buildingUnit?: string
  supervisorUnit?: string
  constructionUnit?: string
  witnessUnit?: string
  samplingLocation?: string
  witness?: string
  witnessPhone?: string
  inspector?: string
  inspectorPhone?: string
  receivedBy: string
  sampleSource: string
  testCategory: string
  judgmentBasis?: string[]
  testingBasis?: string[]
  testParameters?: string[]
  remark?: string
}

interface ReceiptFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues?: Partial<SampleReceipt>
  contracts: Contract[]
  onSubmit: (values: ReceiptFormValues) => void
  onCancel: () => void
  loading?: boolean
}

const SAMPLE_SOURCES = ['施工送检', '现场抽样', '监督抽查']
const TEST_CATEGORIES = ['委托检验', '见证取样', '监督抽查']

/** 接样表单（全量字段）——参考 v2.0-006，类型映射到现行 inspection 模型。
 * 报告名称 = InspectionReportName；判定/检测依据按 role=JUDGMENT/TESTING 从报告名称关联取；
 * 检测参数按选中标准的并集过滤。样品子表复用 SampleManagerModal。 */
export function ReceiptFormModal({
  open,
  mode,
  initialValues,
  contracts,
  onSubmit,
  onCancel,
  loading = false,
}: ReceiptFormModalProps) {
  const currentUser = useAuthStore((s) => s.user)
  const [contractId, setContractId] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [commissionCode, setCommissionCode] = useState('')
  const [commissionDate, setCommissionDate] = useState(
    new Date().toISOString().split('T')[0] ?? '',
  )
  const [samplingLocation, setSamplingLocation] = useState('')
  const [witness, setWitness] = useState('')
  const [witnessPhone, setWitnessPhone] = useState('')
  const [inspector, setInspector] = useState('')
  const [inspectorPhone, setInspectorPhone] = useState('')
  const [sampleSource, setSampleSource] = useState('施工送检')
  const [testCategory, setTestCategory] = useState('委托检验')
  const [judgmentBasis, setJudgmentBasis] = useState<string[]>([])
  const [testingBasis, setTestingBasis] = useState<string[]>([])
  const [testParameters, setTestParameters] = useState<string[]>([])
  const [remark, setRemark] = useState('')

  const [reportNames, setReportNames] = useState<InspectionReportName[]>([])
  const [allStandards, setAllStandards] = useState<InspectionStandard[]>([])
  const [allParameters, setAllParameters] = useState<InspectionParameter[]>([])
  /** 报告名称关联的标准 code（按 role 拆） */
  const [judgmentStandardCodes, setJudgmentStandardCodes] = useState<Set<string>>(
    new Set(),
  )
  const [testingStandardCodes, setTestingStandardCodes] = useState<Set<string>>(new Set())
  /** 选中标准并集对应的参数 code */
  const [selectedParamCodes, setSelectedParamCodes] = useState<Set<string>>(new Set())
  /** 报告名称关联的参数 code（未选标准时用它兜底，而非展示全部参数） */
  const [reportParamCodes, setReportParamCodes] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<{
    contractId?: string
    categoryCode?: string
    commissionCode?: string
  }>({})

  // 报告名称 / 全部标准 / 全部参数（启动加载一次）
  useEffect(() => {
    apiClient
      .get<{ items: InspectionReportName[] }>(API_ROUTES['/report-names'], {
        params: { page: 1, pageSize: 200 },
      })
      .then((r) => setReportNames(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(() => setReportNames([]))
    apiClient
      .get<{ items: InspectionStandard[] }>(API_ROUTES['/inspection-standards'], {
        params: { page: 1, pageSize: 200 },
      })
      .then((r) => setAllStandards(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(() => setAllStandards([]))
    apiClient
      .get<{ items: InspectionParameter[] }>(API_ROUTES['/inspection-parameters'], {
        // 全部参数（>500 条）一次拉齐，否则报告关联的高位编码参数(如 IP-0548..)被分页截断，勾不到。
        params: { page: 1, pageSize: 1000 },
      })
      .then((r) => setAllParameters(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(() => setAllParameters([]))
  }, [])

  // 按报告名称加载关联标准（role=JUDGMENT / TESTING）
  useEffect(() => {
    if (!categoryCode) {
      setJudgmentStandardCodes(new Set())
      setTestingStandardCodes(new Set())
      return
    }
    const load = async (role: 'JUDGMENT' | 'TESTING') => {
      try {
        const res = await apiClient.get<{
          items: {
            reportNameCode: string
            inspectionStandardCode: string
            role: string
          }[]
        }>(API_ROUTES['/inspection-report-name-standards'], {
          params: { reportNameCode: categoryCode, role, page: 1, pageSize: 200 },
        })
        return new Set(res.data.items.map((i) => i.inspectionStandardCode))
      } catch {
        return new Set<string>()
      }
    }
    Promise.all([load('JUDGMENT'), load('TESTING')]).then(([j, t]) => {
      setJudgmentStandardCodes(j)
      setTestingStandardCodes(t)
    })
  }, [categoryCode])

  // 按报告名称加载关联参数（未选标准时的默认可选集，避免展示全部参数）
  useEffect(() => {
    if (!categoryCode) {
      setReportParamCodes(new Set())
      return
    }
    apiClient
      .get<{ items: { reportNameCode: string; inspectionParameterCode: string }[] }>(
        API_ROUTES['/inspection-report-name-parameters'],
        { params: { reportNameCode: categoryCode, page: 1, pageSize: 500 } },
      )
      .then((r) => setReportParamCodes(new Set(r.data.items.map((i) => i.inspectionParameterCode))))
      .catch(() => setReportParamCodes(new Set()))
  }, [categoryCode])

  // 按选中标准加载关联参数
  useEffect(() => {
    const selected = [...judgmentBasis, ...testingBasis]
    if (selected.length === 0) {
      setSelectedParamCodes(new Set())
      return
    }
    Promise.all(
      selected.map((code) =>
        apiClient
          .get<{ items: { inspectionStandardCode: string; inspectionParameterCode: string }[] }>(
            API_ROUTES['/standard-parameters'],
            {
              params: { standardCode: code, page: 1, pageSize: 200 },
            },
          )
          .then((r) => r.data.items)
          .catch(() => [] as { inspectionStandardCode: string; inspectionParameterCode: string }[]),
      ),
    ).then((results) => {
      const set = new Set<string>()
      results.forEach((items) => items.forEach((i) => set.add(i.inspectionParameterCode)))
      setSelectedParamCodes(set)
    })
  }, [judgmentBasis, testingBasis])

  // 打开时初始化
  useEffect(() => {
    if (!open) return
    setContractId(initialValues?.contractId ?? '')
    setCategoryCode(initialValues?.categoryCode ?? '')
    setCommissionCode(initialValues?.commissionCode ?? '')
    setCommissionDate(
      initialValues?.commissionDate ?? new Date().toISOString().slice(0, 10),
    )
    setSamplingLocation(initialValues?.samplingLocation ?? '')
    setWitness(initialValues?.witness ?? '')
    setWitnessPhone(initialValues?.witnessPhone ?? '')
    setInspector(initialValues?.inspector ?? '')
    setInspectorPhone(initialValues?.inspectorPhone ?? '')
    setSampleSource(initialValues?.sampleSource ?? '施工送检')
    setTestCategory(initialValues?.testCategory ?? '委托检验')
    setJudgmentBasis(initialValues?.judgmentBasis ?? [])
    setTestingBasis(initialValues?.testingBasis ?? [])
    setTestParameters(initialValues?.testParameters ?? [])
    setRemark(initialValues?.remark ?? '')
    setErrors({})
  }, [open, initialValues])

  const judgmentCandidates = allStandards.filter((s) => judgmentStandardCodes.has(s.code))
  const testingCandidates = allStandards.filter((s) => testingStandardCodes.has(s.code))
  // 参数可选集优先级：选中标准的并集 > 报告名称关联参数 > 全部参数（都为空时兜底）
  const filteredParameters =
    selectedParamCodes.size > 0
      ? allParameters.filter((p) => selectedParamCodes.has(p.code))
      : reportParamCodes.size > 0
        ? allParameters.filter((p) => reportParamCodes.has(p.code))
        : allParameters

  const toggleInList = (list: string[], value: string) =>
    list.includes(value) ? list.filter((c) => c !== value) : [...list, value]

  if (!open) return null

  const contract = contracts.find((c) => c.id === contractId)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const nextErrors: typeof errors = {}
    if (!contractId) nextErrors.contractId = '请选择合同'
    if (!categoryCode) nextErrors.categoryCode = '请选择报告名称'
    if (!commissionCode.trim()) nextErrors.commissionCode = '委托书编号必填'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit({
      id: initialValues?.id,
      contractId,
      categoryCode,
      commissionCode: commissionCode.trim(),
      commissionDate,
      projectName: contract?.projectName ?? '',
      clientUnit: contract?.clientUnit ?? '',
      buildingUnit: contract?.buildingUnit,
      supervisorUnit: contract?.supervisorUnit,
      constructionUnit: contract?.constructionUnit,
      witnessUnit: contract?.witnessUnit,
      samplingLocation: samplingLocation.trim() || undefined,
      witness: witness.trim() || undefined,
      witnessPhone: witnessPhone.trim() || undefined,
      inspector: inspector.trim() || undefined,
      inspectorPhone: inspectorPhone.trim() || undefined,
      receivedBy: currentUser?.displayName ?? currentUser?.username ?? '系统',
      sampleSource,
      testCategory,
      judgmentBasis: judgmentBasis.length > 0 ? judgmentBasis : undefined,
      testingBasis: testingBasis.length > 0 ? testingBasis : undefined,
      testParameters: testParameters.length > 0 ? testParameters : undefined,
      remark: remark.trim() || undefined,
    })
  }

  const standardCheckboxGrid = (
    list: string[],
    setter: (v: string[]) => void,
    candidates: InspectionStandard[],
  ) => (
    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
      {candidates.length === 0 && (
        <span className="text-xs text-gray-400">（该报告名称未关联标准）</span>
      )}
      {candidates.map((s) => (
        <label key={s.code} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            value={s.code}
            checked={list.includes(s.code)}
            onChange={(e) => setter(toggleInList(list, e.target.value))}
          />
          <span>
            {s.code} {s.name}
          </span>
        </label>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[94vh] flex flex-col">
        <header className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-base font-semibold">
            {mode === 'create' ? '新建接样单' : '编辑接样单'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </header>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  所属合同 *
                </label>
                <select
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  disabled={mode === 'edit'}
                  className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                >
                  <option value="">请选择合同</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contractCode}　{c.projectName}
                    </option>
                  ))}
                </select>
                {errors.contractId && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.contractId}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  报告名称 *
                </label>
                <select
                  value={categoryCode}
                  onChange={(e) => {
                    setCategoryCode(e.target.value)
                    setJudgmentBasis([])
                    setTestingBasis([])
                    setTestParameters([])
                  }}
                  disabled={mode === 'edit'}
                  className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                >
                  <option value="">请选择报告名称</option>
                  {reportNames.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {errors.categoryCode && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.categoryCode}</p>
                )}
              </div>
            </div>

            {contract && (
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 bg-gray-50 border rounded p-3">
                <div>工程名称：{contract.projectName}</div>
                <div>委托单位：{contract.clientUnit ?? '—'}</div>
                <div>建设单位：{contract.buildingUnit ?? '—'}</div>
                <div>监理单位：{contract.supervisorUnit ?? '—'}</div>
                <div>施工单位：{contract.constructionUnit ?? '—'}</div>
                <div>见证单位：{contract.witnessUnit ?? '—'}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  委托书编号 *
                </label>
                <input
                  value={commissionCode}
                  onChange={(e) => setCommissionCode(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="如 WT-2024-0801-01"
                />
                {errors.commissionCode && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.commissionCode}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  委托日期
                </label>
                <input
                  type="date"
                  value={commissionDate}
                  onChange={(e) => setCommissionDate(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  样品来源
                </label>
                <select
                  value={sampleSource}
                  onChange={(e) => setSampleSource(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  {SAMPLE_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  检测类别
                </label>
                <select
                  value={testCategory}
                  onChange={(e) => setTestCategory(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  {TEST_CATEGORIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  见证人
                </label>
                <input
                  value={witness}
                  onChange={(e) => setWitness(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  见证人电话
                </label>
                <input
                  value={witnessPhone}
                  onChange={(e) => setWitnessPhone(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  送检人
                </label>
                <input
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  送检人电话
                </label>
                <input
                  value={inspectorPhone}
                  onChange={(e) => setInspectorPhone(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                取样地点
              </label>
              <input
                value={samplingLocation}
                onChange={(e) => setSamplingLocation(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                判定依据（role=JUDGMENT 关联标准）
              </label>
              {standardCheckboxGrid(judgmentBasis, setJudgmentBasis, judgmentCandidates)}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                检测依据（role=TESTING 关联标准）
              </label>
              {standardCheckboxGrid(testingBasis, setTestingBasis, testingCandidates)}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                检测参数
                {selectedParamCodes.size === 0
                  ? reportParamCodes.size > 0
                    ? '（未选标准时显示报告关联参数）'
                    : '（未选标准时显示全部）'
                  : ''}
              </label>
              <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
                {filteredParameters.length === 0 && (
                  <span className="text-xs text-gray-400">（无参数）</span>
                )}
                {filteredParameters.map((p) => (
                  <label key={p.code} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      value={p.code}
                      checked={testParameters.includes(p.code)}
                      onChange={(e) =>
                        setTestParameters(toggleInList(testParameters, e.target.value))
                      }
                    />
                    <span>
                      {p.canonicalName || p.name}
                      {p.unit ? `（${p.unit}）` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
              <input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            {mode === 'edit' && initialValues?.id && (
              <div className="border-t pt-3">
                <SampleManagerModal
                  inline
                  receipt={initialValues as SampleReceipt}
                  onClose={() => {}}
                />
              </div>
            )}
          </div>
          <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-sm border rounded hover:bg-gray-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default ReceiptFormModal
