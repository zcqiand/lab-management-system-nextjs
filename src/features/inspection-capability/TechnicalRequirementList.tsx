"use client";
import { useEffect, useState } from 'react'
// REF src/features/inspection-capability/TechnicalRequirementList.tsx 移植。
// TSOT Phase C2：legacy apiClient/API_ROUTES 全部替换为 orval 生成函数。
// 技术要求主键是 (object, parameter, judgmentStandard) 三段复合键而非 id：
// PUT/DELETE 走契约复合键端点（行内含原始字段，不反解 derived id）。
import {
  technicalRequirementsCreateTechnicalRequirement,
  technicalRequirementsDeleteTechnicalRequirement,
  technicalRequirementsListTechnicalRequirements,
  technicalRequirementsUpdateTechnicalRequirement,
} from '@/api/endpoints/technical-requirements/technical-requirements'
import {
  inspectionDictionaryListObjects,
  inspectionDictionaryListParameters,
} from '@/api/endpoints/inspection-dictionary/inspection-dictionary'
import type {
  CreateTechnicalRequirementRequest,
  TechnicalRequirement,
  UpdateTechnicalRequirementRequest,
} from '@/api/endpoints/model'
import { ConfirmModal } from '@/components/ConfirmModal'
import {
  TwoLevelObjectStandardTree,
  type TreeListItem,
} from './TwoLevelObjectStandardTree'

/** 行结构 = 契约 TechnicalRequirement + 后端列表补列的 derived id
 *  （tr-<obj>-<param>-<std>，仅作 React key/拖拽 id 用，不再用于寻址）。 */
interface TechRow extends TechnicalRequirement, TreeListItem {
  id: string
  parameterName?: string
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
  deleteDataFn = 'M06.F06.I05',
}: {
  dataFn?: string
  createDataFn?: string
  editDataFn?: string
  deleteDataFn?: string
} = {}) {
  const [open, setOpen] = useState(false)
  // 编辑中的原始行：PUT 复合键寻址用行内三段键，不再持有 derived id。
  const [editRow, setEditRow] = useState<TechRow | null>(null)
  const [form, setForm] = useState<Record<string, string>>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [objects, setObjects] = useState<Opt[]>([])
  const [params, setParams] = useState<Opt[]>([])
  const [selectedStandard, setSelectedStandard] = useState<string | null>(null)
  const [listVersion, setListVersion] = useState(0)

  useEffect(() => {
    inspectionDictionaryListObjects({ page: 1, pageSize: 1000 }).then((r) => setObjects((r.items ?? []) as Opt[])).catch(() => {})
    inspectionDictionaryListParameters({ page: 1, pageSize: 1000 }).then((r) => setParams((r.items ?? []) as Opt[])).catch(() => {})
  }, [])

  const reloadList = () => {
    // 列表数据版本号：增删改后 +1 强制树 refetch。不能走「null→setTimeout 设回原值」——
    // 批量更新下 React Object.is bailout 吞掉终值相等的状态变化，零重渲染零 refetch
    //（2026-09-13 e2e 三端一致性实测抓出：新建后列表不刷新，react/vue 同场景会刷新）
    setListVersion((v) => v + 1)
  }

  const openCreate = () => {
    setEditRow(null)
    setForm({ ...emptyForm, judgmentStandardCode: selectedStandard ?? '' })
    setError(null)
    setOpen(true)
  }

  const openEdit = (row: TechRow) => {
    setEditRow(row)
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
    try {
      if (editRow) {
        // 契约 UpdateTechnicalRequirementRequest 不含三段键字段（键在 path 上），
        // 检测项目/检测参数在编辑态语义上不可改（后端按原键定位）。
        const payload: UpdateTechnicalRequirementRequest = {
          brand: form.brand || undefined,
          model: form.model || undefined,
          grade: form.grade || undefined,
          spec: form.spec || undefined,
          minValue: form.minValue === '' ? undefined : Number(form.minValue),
          maxValue: form.maxValue === '' ? undefined : Number(form.maxValue),
          comparison: form.comparison as UpdateTechnicalRequirementRequest['comparison'],
          remark: form.remark || undefined,
        }
        await technicalRequirementsUpdateTechnicalRequirement(
          editRow.inspectionObjectCode,
          editRow.inspectionParameterCode,
          editRow.judgmentStandardCode,
          payload,
        )
      } else {
        const payload: CreateTechnicalRequirementRequest = {
          inspectionObjectCode: form.inspectionObjectCode,
          inspectionParameterCode: form.inspectionParameterCode,
          judgmentStandardCode: form.judgmentStandardCode,
          brand: form.brand || undefined,
          model: form.model || undefined,
          grade: form.grade || undefined,
          spec: form.spec || undefined,
          minValue: form.minValue === '' ? undefined : Number(form.minValue),
          maxValue: form.maxValue === '' ? undefined : Number(form.maxValue),
          comparison: form.comparison as CreateTechnicalRequirementRequest['comparison'],
          remark: form.remark || undefined,
        }
        await technicalRequirementsCreateTechnicalRequirement(payload)
      }
      setOpen(false)
      if (selectedStandard) reloadList()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败')
    }
  }

  const remove = async (row: TechRow) => {
    if (!confirm('确定删除？')) return
    await technicalRequirementsDeleteTechnicalRequirement(
      row.inspectionObjectCode,
      row.inspectionParameterCode,
      row.judgmentStandardCode,
    )
    if (selectedStandard) reloadList()
  }

  return (
    // @entry M06.F06.I01 技术要求列表页（检测能力模块的「技术要求」路由 /inspection-technical-requirements）
    <div data-fn={dataFn} className="flex flex-col flex-1 min-h-0">
      {/* @entry M06.F06.I02 技术要求新建/编辑按钮（TwoLevelObjectStandardTree 内"新建"+"编辑"） */}
      {/* @entry M06.F06.I05 技术要求删除按钮（TwoLevelObjectStandardTree 内行"删除"） */}
      <TwoLevelObjectStandardTree<TechRow>
        title="技术要求"
        dataFn={dataFn}
        listName="technical-requirements"
        listFn={(standardCode) =>
          technicalRequirementsListTechnicalRequirements({
            judgmentStandardCode: standardCode,
          }).then((rows) => (rows ?? []) as TechRow[])
        }
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
        reloadSignal={listVersion}
        selectedStandard={selectedStandard}
        onSelectedStandardChange={setSelectedStandard}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={remove}
      />

      <ConfirmModal
        open={open}
        title={editRow ? '编辑技术要求' : '新建技术要求'}
        message={
          <div className="space-y-3 text-left text-sm">
            {error && <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
            <label className="block">
              <span className="text-xs text-gray-600">检测项目</span>
              <select aria-label="检测项目" value={form.inspectionObjectCode} disabled={Boolean(editRow)} onChange={(e) => setForm({ ...form, inspectionObjectCode: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5 disabled:bg-gray-100">
                <option value="">选择检测项目</option>
                {objects.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">检测参数</span>
              <select aria-label="检测参数" value={form.inspectionParameterCode} disabled={Boolean(editRow)} onChange={(e) => setForm({ ...form, inspectionParameterCode: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5 disabled:bg-gray-100">
                <option value="">选择检测参数</option>
                {params.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">判定标准</span>
              <input aria-label="判定标准" value={form.judgmentStandardCode} disabled={Boolean(editRow)} onChange={(e) => setForm({ ...form, judgmentStandardCode: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5 font-mono disabled:bg-gray-100" placeholder="如 GB/T 228.1-2021" />
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
