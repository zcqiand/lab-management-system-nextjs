import { useEffect, useState } from 'react'
import { useSampleStore } from '@/state/sampleStore'
import { SampleFormModal, type SampleFormValues } from './SampleFormModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import type { Sample, SampleStatus, SampleQuery } from '@/types/api'

const PAGE_SIZE = 10

export function SampleList() {
  const { list, total, loading, error, fetchSamples, createSample, updateSample, deleteSample } =
    useSampleStore()

  const [page, setPage] = useState(1)
  const [keyword, setSearchKeyword] = useState('')
  const [status, setStatus] = useState<SampleStatus | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editing, setEditing] = useState<Sample | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Sample | null>(null)
  const [deleting, setDeleting] = useState(false)

  const buildQuery = (p: number): SampleQuery => ({
    page: p,
    pageSize: PAGE_SIZE,
    keyword: keyword || undefined,
    status: status || undefined,
  })

  useEffect(() => {
    fetchSamples(buildQuery(page))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleSearch = () => {
    setPage(1)
    fetchSamples(buildQuery(1))
  }

  const handleStatusChange = (value: SampleStatus | '') => {
    setStatus(value)
    setPage(1)
    const q: SampleQuery = {
      page: 1,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      status: value || undefined,
    }
    fetchSamples(q)
  }

  const openCreate = () => {
    setFormMode('create')
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (sample: Sample) => {
    setFormMode('edit')
    setEditing(sample)
    setFormOpen(true)
  }

  const handleSubmit = async (values: SampleFormValues) => {
    setSubmitting(true)
    try {
      if (formMode === 'create') {
        await createSample(values as Parameters<typeof createSample>[0])
      } else if (values.id) {
        await updateSample(values.id, values as Parameters<typeof updateSample>[1])
      }
      setFormOpen(false)
      await fetchSamples(buildQuery(page))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSample(deleteTarget.id)
      setDeleteTarget(null)
      await fetchSamples(buildQuery(page))
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">样品管理</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          新增样品
        </button>
      </div>

      <div className="flex items-center gap-2 bg-white p-3 rounded shadow-sm">
        <input
          placeholder="搜索样品名称/编号"
          value={keyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="border rounded px-3 py-1.5 text-sm flex-1"
        />
        <label className="text-sm text-gray-600 flex items-center gap-1">
          状态筛选
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as SampleStatus | '')}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">全部</option>
            <option value="pending">待检</option>
            <option value="testing">检测中</option>
            <option value="completed">已完成</option>
            <option value="rejected">已拒收</option>
          </select>
        </label>
        <button
          onClick={handleSearch}
          className="px-4 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800"
        >
          搜索
        </button>
      </div>

      {error && (
        <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm min-w-200">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left">型号/规格/等级/牌号</th>
              <th className="px-4 py-2 text-left min-w-30">生产厂家/产地</th>
              <th className="px-4 py-2 text-left min-w-25">结构部位</th>
              <th className="px-4 py-2 text-left min-w-20">代表数量</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  加载中...
                </td>
              </tr>
            )}
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
            {list.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div>{[s.model, s.specification, s.grade, s.brand].filter(Boolean).join(' / ') || '—'}</div>
                  <div className="text-xs text-gray-400">{s.sampleCode}</div>
                </td>
                <td className="px-4 py-2">{s.manufacturer ?? '—'}</td>
                <td className="px-4 py-2">{s.structuralPart ?? '—'}</td>
                <td className="px-4 py-2">{s.representQuantity ?? '—'}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button
                    onClick={() => openEdit(s)}
                    className="px-2 py-1 text-blue-600 hover:underline"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="px-2 py-1 text-red-600 hover:underline"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>共 {total} 条</span>
        <div className="space-x-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>

      <SampleFormModal
        open={formOpen}
        mode={formMode}
        initialValues={editing ?? undefined}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={submitting}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="删除确认"
        message={`确定删除样品「${deleteTarget?.sampleName ?? ''}」？此操作不可撤销。`}
        confirmText="确认"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default SampleList
