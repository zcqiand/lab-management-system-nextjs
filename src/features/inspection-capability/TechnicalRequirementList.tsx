"use client";
import { useEffect, useState } from 'react'
// REF src/features/inspection-capability/TechnicalRequirementList.tsx 移植。
// 差异：apiClient → @/api/legacy-client + API_ROUTES。msw 技术要求主键是
// (object, parameter, judgmentStandard) 复合键而非 id——组件内 PUT/DELETE 走
// tests 端 shape adapter 兜底（键语义不变，REF 行为保持）。
import { apiClient, API_ROUTES } from '@/api/legacy-client'
import { ConfirmModal } from '@/components/ConfirmModal'
import {
  TwoLevelObjectStandardTree,
  type TreeListItem,
} from './TwoLevelObjectStandardTree'

interface TechRow extends TreeListItem {
  id: string
  inspectionObjectCode: string
  inspectionParameterCode: string
  objectName?: string
  parameterName?: string
  judgmentStandardCode: string
  brand?: string
  model?: string
  grade?: string
  spec?: string
  minValue?: number
  maxValue?: number
  comparison: string
  remark?: string
}

interface Opt {
  code: string
  name: string
}

const COMPARISONS = ['≥', '≤', '=', 'range', 'eq']
const emptyForm = {
  inspectionObjectCode: '',
  inspectionParameterCode: '',
  judgmentStandardCode: '',
  brand: '',
  model: '',
  grade: '',
  spec: '',
  minValue: '',
  maxValue: '',
  comparison: '≥',
  remark: '',
}

export function TechnicalRequirementList({
  dataFn = 'M06.F06.I01',
  createDataFn = 'M06.F06.I02',
  editDataFn = 'M06.F06.I02',
  deleteDataFn = 'M06.F06.I03',
}: {
  dataFn?: string
  createDataFn?: string
  editDataFn?: string
  deleteDataFn?: string
} = {}) {
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [objects, setObjects] = useState<Opt[]>([])
  const [params, setParams] = useState<Opt[]>([])
  const [selectedStandard, setSelectedStandard] = useState<string | null>(null)

  useEffect(() => {
    apiClient.get<{ items: Opt[] }>(API_ROUTES['/inspection-objects'], { params: { page: 1, pageSize: '1000' } }).then((r) => setObjects(r.data?.items ?? [])).catch(() => {})
    apiClient.get<{ items: Opt[] }>(API_ROUTES['/inspection-parameters'], { params: { page: 1, pageSize: '1000' } }).then((r) => setParams(r.data?.items ?? [])).catch(() => {})
  }, [])

  const reloadList = (standardCode: string) => {
    setSelectedStandard(null)
    setTimeout(() => setSelectedStandard(standardCode), 0)
  }

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm, judgmentStandardCode: selectedStandard ?? '' })
    setError(null)
    setOpen(true)
  }

  const openEdit = (row: TechRow) => {
    setEditId(row.id)
    setForm({
      inspectionObjectCode: row.inspectionObjectCode,
      inspectionParameterCode: row.inspectionParameterCode,
      judgmentStandardCode: row.judgmentStandardCode,
      brand: row.brand ?? '',
      model: row.model ?? '',
      grade: row.grade ?? '',
      spec: row.spec ?? '',
      minValue: row.minValue != null ? String(row.minValue) : '',
      maxValue: row.maxValue != null ? String(row.maxValue) : '',
      comparison: row.comparison ?? '≥',
      remark: row.remark ?? '',
    })
    setError(null)
    setOpen(true)
  }

  const save = async () => {
    setError(null)
    const payload = {
      inspectionObjectCode: form.inspectionObjectCode,
      inspectionParameterCode: form.inspectionParameterCode,
      judgmentStandardCode: form.judgmentStandardCode,
      brand: form.brand || undefined,
      model: form.model || undefined,
      grade: form.grade || undefined,
      spec: form.spec || undefined,
      minValue: form.minValue === '' ? undefined : Number(form.minValue),
      maxValue: form.maxValue === '' ? undefined : Number(form.maxValue),
      comparison: form.comparison,
      remark: form.remark || undefined,
    }
    try {
      if (editId) await apiClient.put(`${API_ROUTES['/inspection-technical-requirements']}/${editId}`, payload)
      else await apiClient.post(API_ROUTES['/inspection-technical-requirements'], payload)
      setOpen(false)
      if (selectedStandard) reloadList(selectedStandard)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除？')) return
    await apiClient.delete(`${API_ROUTES['/inspection-technical-requirements']}/${id}`)
    if (selectedStandard) reloadList(selectedStandard)
  }

  const buildPutBody = (_item: TechRow, sortOrder: number) => ({ sortOrder })

  return (
    // @entry M06.F06.I01 技术要求列表页（检测能力模块的「技术要求」路由 /inspection-technical-requirements）
    <div data-fn={dataFn} className="flex flex-col flex-1 min-h-0">
      {/* @entry M06.F06.I02 技术要求新建/编辑按钮（TwoLevelObjectStandardTree 内"新建"+"编辑"） */}
      {/* @entry M06.F06.I03 技术要求删除按钮（TwoLevelObjectStandardTree 内行"删除"） */}
      <TwoLevelObjectStandardTree<TechRow>
        title="技术要求"
        dataFn={dataFn}
        listEndpoint="/inspection-technical-requirements"
        listFilterParam="judgmentStandardCode"
        createDataFn={createDataFn}
        editDataFn={editDataFn}
        deleteDataFn={deleteDataFn}
        sortBy={['inspectionParameterCode', 'spec', 'model', 'brand', 'grade']}
        getItemId={(it) => it.id}
        columns={[
          { key: 'inspectionParameterCode', label: '检测参数', width: 'w-32', render: (it) => it.parameterName ?? it.inspectionParameterCode },
          { key: 'spec', label: '规格', width: 'w-24' },
          { key: 'model', label: '型号', width: 'w-20' },
          { key: 'brand', label: '牌号', width: 'w-24' },
          { key: 'grade', label: '等级', width: 'w-16' },
          { key: 'comparison', label: '判定方式', width: 'w-20', align: 'center' },
          { key: 'maxValue', label: '上限', width: 'w-20', align: 'right' },
          { key: 'minValue', label: '下限', width: 'w-20', align: 'right' },
        ]}
        buildPutBody={buildPutBody}
        selectedStandard={selectedStandard}
        onSelectedStandardChange={setSelectedStandard}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={(it) => remove(it.id)}
      />

      <ConfirmModal
        open={open}
        title={editId ? '编辑技术要求' : '新建技术要求'}
        message={
          <div className="space-y-3 text-left text-sm">
            {error && <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
            <label className="block">
              <span className="text-xs text-gray-600">检测项目</span>
              <select aria-label="检测项目" value={form.inspectionObjectCode} onChange={(e) => setForm({ ...form, inspectionObjectCode: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5">
                <option value="">选择检测项目</option>
                {objects.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">检测参数</span>
              <select aria-label="检测参数" value={form.inspectionParameterCode} onChange={(e) => setForm({ ...form, inspectionParameterCode: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5">
                <option value="">选择检测参数</option>
                {params.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">判定标准</span>
              <input aria-label="判定标准" value={form.judgmentStandardCode} onChange={(e) => setForm({ ...form, judgmentStandardCode: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5 font-mono" placeholder="如 GB/T 228.1-2021" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-gray-600">牌号</span>
                <input aria-label="牌号" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">型号</span>
                <input aria-label="型号" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">等级</span>
                <input aria-label="等级" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">规格</span>
                <input aria-label="规格" value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-xs text-gray-600">判定方式</span>
                <select aria-label="判定方式" value={form.comparison} onChange={(e) => setForm({ ...form, comparison: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5">
                  {COMPARISONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">下限</span>
                <input aria-label="下限" type="number" value={form.minValue} onChange={(e) => setForm({ ...form, minValue: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">上限</span>
                <input aria-label="上限" type="number" value={form.maxValue} onChange={(e) => setForm({ ...form, maxValue: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-gray-600">备注</span>
              <input aria-label="备注" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
            </label>
          </div>
        }
        confirmText="保存"
        loading={false}
        onConfirm={save}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}

export default TechnicalRequirementList
