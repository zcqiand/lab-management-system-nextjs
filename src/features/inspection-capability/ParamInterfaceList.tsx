"use client";
import { useEffect, useState } from 'react'
// REF src/features/inspection-capability/ParamInterfaceList.tsx 移植。
// 差异：apiClient → @/api/legacy-client + API_ROUTES（link 端点映射到
// /api/param-interfaces/links）。
import { apiClient, API_ROUTES } from '@/api/legacy-client'
import { AssociationManager } from './AssociationManager'
import { ParamInterfacePreviewModal } from './ParamInterfacePreviewModal'

interface ParamInterface {
  id: string
  code: string
  name: string
  componentPath?: string
  config?: Record<string, unknown> | null
  description?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface ParamInterfaceParameterLink {
  paramInterfaceCode: string
  inspectionParameterCode: string
}
interface InspectionParameter {
  code: string
  name: string
}

const PAGE_SIZE = 50
/** 拉全量关联用的大页。 */
const BIG_PAGE = '10000'

type TabKey = 'basic' | 'parameters'

const emptyForm = {
  code: '',
  name: '',
  componentPath: '',
  config: '',
  description: '',
  sortOrder: '0',
}

const TAB_LABELS: Record<TabKey, string> = {
  basic: '基础信息',
  parameters: '关联检测参数',
}

const TAB_ORDER: TabKey[] = ['basic', 'parameters']

/** 聚合单元格：逗号分隔展示，超过 LIMIT 条截断为 "+N"，完整清单放 title。 */
const AGG_LIMIT = 5
function AggregateList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (items.length === 0) return <span className="text-gray-400">{emptyText}</span>
  const shown = items.slice(0, AGG_LIMIT)
  const rest = items.length - shown.length
  const text = rest > 0 ? `${shown.join('、')} 等 ${items.length} 项` : shown.join('、')
  return (
    <span title={items.join('、')} className="block max-w-md truncate">
      {text}
    </span>
  )
}

export function ParamInterfaceList() {
  const [rows, setRows] = useState<ParamInterface[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [savedCode, setSavedCode] = useState<string | null>(null) // 用于关联页签
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [form, setForm] = useState<Record<string, string>>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  // 聚合列数据：参数界面 → 参数编码集，以及参数编码→名称
  const [paramByPi, setParamByPi] = useState<Record<string, string[]>>({})
  const [paramNameByCode, setParamNameByCode] = useState<Record<string, string>>({})
  const [previewRow, setPreviewRow] = useState<ParamInterface | null>(null)

  const load = () => {
    setLoading(true)
    apiClient
      .get<{ items: ParamInterface[]; total: number }>(API_ROUTES['/param-interfaces'], {
        params: { page, pageSize: String(PAGE_SIZE) },
      })
      .then((res) => {
        setRows(Array.isArray(res.data?.items) ? res.data.items : [])
        setTotal(typeof res.data?.total === 'number' ? res.data.total : 0)
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [page])

  const loadAssociations = () => {
    Promise.all([
      apiClient.get<{ items: ParamInterfaceParameterLink[] }>(API_ROUTES['/inspection-parameter-param-interfaces'], {
        params: { pageSize: BIG_PAGE },
      }),
      apiClient.get<{ items: InspectionParameter[] }>(API_ROUTES['/inspection-parameters'], {
        params: { pageSize: BIG_PAGE },
      }),
    ]).then(([paramRes, paramMasterRes]) => {
      const paramMap: Record<string, string[]> = {}
      for (const link of paramRes.data?.items ?? []) {
        const pk = link.paramInterfaceCode ?? ''
        const arr = paramMap[pk] ?? []
        if (link.inspectionParameterCode && !arr.includes(link.inspectionParameterCode)) arr.push(link.inspectionParameterCode)
        paramMap[pk] = arr
      }
      for (const k of Object.keys(paramMap)) paramMap[k]!.sort()
      setParamByPi(paramMap)

      const nameMap: Record<string, string> = {}
      for (const p of paramMasterRes.data?.items ?? []) nameMap[p.code] = p.name
      setParamNameByCode(nameMap)
    })
  }
  useEffect(loadAssociations, [])

  const openCreate = () => {
    setEditId(null)
    setSavedCode(null)
    setForm(emptyForm)
    setActiveTab('basic')
    setError(null)
    setFormOpen(true)
  }
  const openEdit = (row: ParamInterface) => {
    setEditId(row.id)
    setSavedCode(row.code)
    setForm({
      code: row.code,
      name: row.name,
      componentPath: row.componentPath ?? '',
      config: JSON.stringify(row.config ?? '', null, 2),
      description: row.description ?? '',
      sortOrder: String(row.sortOrder ?? 0),
    })
    setActiveTab('basic')
    setError(null)
    setFormOpen(true)
  }

  const save = async () => {
    setError(null)
    let configParsed: Record<string, unknown> | null = null
    if ((form.config ?? "").trim()) {
      try {
        configParsed = JSON.parse(form.config ?? "")
      } catch {
        setError('config 非合法 JSON')
        return
      }
    }
    const payload = {
      code: form.code,
      name: form.name,
      componentPath: form.componentPath,
      config: configParsed,
      description: form.description || undefined,
      sortOrder: Number(form.sortOrder) || 0,
    }
    try {
      if (editId) {
        await apiClient.put(`${API_ROUTES['/param-interfaces']}/${editId}`, payload)
      } else {
        await apiClient.post(API_ROUTES['/param-interfaces'], payload)
      }
      // 首次保存后允许跳转关联页签
      setSavedCode(form.code || null)
      setEditId(form.code || null)
      load()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败')
    }
  }

  const remove = async (id: string) => {
    try {
      await apiClient.delete(`${API_ROUTES['/param-interfaces']}/${id}`)
      load()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '删除失败')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canAssociate = !!savedCode

  const closeForm = () => {
    setFormOpen(false)
    // 关联可能在弹窗页签里被改过，刷新聚合列
    loadAssociations()
  }

  return (
    <div className="space-y-4" data-fn="M06.F08.I01">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">参数界面</h2>
        <button
          type="button"
          onClick={openCreate}
          data-fn="M06.F08.I02"
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          新建参数界面
        </button>
      </header>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left">编码</th>
              <th className="px-4 py-2 text-left">界面名称</th>
              <th className="px-4 py-2 text-left">组件路径</th>
              <th className="px-4 py-2 text-left">关联参数</th>
              <th className="px-4 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">加载中...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">暂无数据</td></tr>
            )}
            {rows.map((r) => {
              const params = (paramByPi[r.code] ?? []).map((c) => paramNameByCode[c] ?? c)
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50 align-top">
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.componentPath ?? '-'}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    <AggregateList items={params} emptyText="-" />
                  </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setPreviewRow(r)}
                      data-fn="M06.F08.I05"
                      aria-label={`预览 ${r.id}`}
                      className="text-gray-600 hover:underline mr-3"
                    >
                      预览
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      data-fn="M06.F08.I02"
                      aria-label={`编辑 ${r.id}`}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      data-fn="M06.F08.I03"
                      aria-label={`删除 ${r.id}`}
                      className="text-red-600 hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>共 {total} 条</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            上一页
          </button>
          <span>第 {page} / {totalPages} 页</span>
          <button
            type="button"
            aria-label="下一页"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>

      {formOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editId ? `编辑参数界面 — ${savedCode}` : '新建参数界面'}</h3>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-700 text-xl" aria-label="关闭">×</button>
            </div>

            {/* 页签 */}
            <div role="tablist" className="flex border-b text-sm">
              {TAB_ORDER.map((k) => {
                const disabled = (k !== 'basic' && !canAssociate)
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === k}
                    aria-controls={`tab-panel-${k}`}
                    disabled={disabled}
                    onClick={() => !disabled && setActiveTab(k)}
                    // @entry M06.F08.I04 关联检测参数（参数界面编辑弹窗的「关联检测参数」页签）
                    data-fn={k === 'basic' ? 'M06.F08.I02' : 'M06.F08.I04'}
                    className={`px-3 py-1.5 -mb-px border-b-2 ${activeTab === k ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-gray-500'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:text-blue-600'}`}
                  >
                    {TAB_LABELS[k]}
                  </button>
                )
              })}
            </div>

            {error && <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

            {activeTab === 'basic' && (
              <div id="tab-panel-basic" role="tabpanel" className="space-y-3">
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">编码</span>
                  <input aria-label="编码" value={form.code} disabled={!!editId} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5 disabled:bg-gray-100" />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">界面名称</span>
                  <input aria-label="界面名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">组件路径（registry key，如 default / concrete-compress）</span>
                  <input aria-label="组件路径" value={form.componentPath} onChange={(e) => setForm({ ...form, componentPath: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5 font-mono text-xs" />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">config（JSON，空合法）</span>
                  <textarea aria-label="config" value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5 font-mono text-xs" rows={6} />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">描述（可选）</span>
                  <input aria-label="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-600">排序</span>
                  <input aria-label="排序" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
                </label>
                <div className="flex justify-between gap-2 pt-2">
                  <button type="button" onClick={closeForm} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100">关闭</button>
                  <button type="button" onClick={save} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                </div>
              </div>
            )}

            {activeTab === 'parameters' && savedCode && (
              <div id="tab-panel-parameters" role="tabpanel" className="space-y-3">
                <AssociationManager
                  ariaLabel={`${savedCode} 关联检测参数`}
                  endpoint="/inspection-parameter-param-interfaces"
                  parentParam="paramInterfaceCode"
                  parentCode={savedCode}
                  targetLabel="检测参数"
                  targetEndpoint="/inspection-parameters"
                  targetParam="inspectionParameterCode"
                  targetValueKey="code"
                  targetTextKey="name"
                  prefilter={{
                    label: '检测项目',
                    endpoint: '/inspection-objects',
                    valueKey: 'code',
                    textKey: 'name',
                    filterEndpoint: '/inspection-object-parameters',
                    filterParamKey: 'inspectionObjectCode',
                    filterResultKey: 'inspectionParameterCode',
                  }}
                  fnId="M06.F08.I04"
                />
              </div>
            )}

            {activeTab !== 'basic' && !savedCode && (
              <div className="text-sm text-gray-400 py-8 text-center">
                请先在「基础信息」页签保存后再设置关联。
              </div>
            )}
          </div>
        </div>
      )}

      {previewRow && (
        <ParamInterfacePreviewModal row={previewRow} onClose={() => setPreviewRow(null)} />
      )}
    </div>
  )
}

export default ParamInterfaceList
