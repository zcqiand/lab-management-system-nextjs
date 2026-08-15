import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuditStore, type AuditType } from '@/state/auditStore'

/** 审计日志类型 Tab 配置 */
const TABS: { label: string; value: AuditType | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '认证', value: 'auth' },
  { label: '合同', value: 'contract' },
  { label: '接样', value: 'receipt' },
  { label: '流程', value: 'flow' },
  { label: '报告', value: 'report' },
  { label: '用户', value: 'user' },
  { label: '角色', value: 'role' },
  { label: '系统', value: 'system' },
]

/** 类型颜色映射 */
const TYPE_COLORS: Record<AuditType, string> = {
  auth: 'bg-purple-100 text-purple-800',
  contract: 'bg-blue-100 text-blue-800',
  receipt: 'bg-green-100 text-green-800',
  flow: 'bg-yellow-100 text-yellow-800',
  report: 'bg-orange-100 text-orange-800',
  user: 'bg-cyan-100 text-cyan-800',
  role: 'bg-indigo-100 text-indigo-800',
  system: 'bg-gray-100 text-gray-800',
}

/** 类型中文名 */
const TYPE_LABELS: Record<AuditType, string> = {
  auth: '认证',
  contract: '合同',
  receipt: '接样',
  flow: '流程',
  report: '报告',
  user: '用户',
  role: '角色',
  system: '系统',
}

const PAGE_SIZE = 20

export function AuditLogList() {
  const { list, total, loading, error, fetchLogs, exportLogs, clearError } = useAuditStore()

  const [activeTab, setActiveTab] = useState<AuditType | 'all'>('all')
  const [keyword, setKeyword] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv')
  const [searchInput, setSearchInput] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    (p: number) => {
      clearError()
      fetchLogs({
        page: p,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        type: activeTab === 'all' ? undefined : activeTab,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
    },
    [keyword, activeTab, dateFrom, dateTo, fetchLogs, clearError],
  )

  // Debounced keyword search
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setKeyword(val)
      setPage(1)
    }, 300)
  }

  useEffect(() => {
    load(page)
  }, [load, page])

  const handleTabChange = (tab: AuditType | 'all') => {
    setActiveTab(tab)
    setPage(1)
  }

  const handleDateChange = (field: 'from' | 'to', val: string) => {
    if (field === 'from') {
      setDateFrom(val)
    } else {
      setDateTo(val)
    }
    setPage(1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportLogs(
        { page: 1, pageSize: total, keyword: keyword || undefined, type: activeTab === 'all' ? undefined : activeTab, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
        exportFormat,
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
          <h2 className="text-lg font-bold text-blue-900">审计日志</h2>
          <p className="text-sm text-blue-600 mt-0.5">共 {total} 条记录</p>
        </div>
      </div>

      {/* 筛选工具栏 */}
      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        {/* Tab 分类 */}
        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                activeTab === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 关键词 + 日期范围 + 操作按钮 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="搜索操作/操作人/对象/详情..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <span>从</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span>至</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
              className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              {exporting ? '导出中...' : '导出'}
            </button>
            <button
              onClick={() => { setKeyword(''); setSearchInput(''); setDateFrom(''); setDateTo(''); setActiveTab('all'); setPage(1) }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 日志列表 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading && list.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-gray-500">加载中...</span>
          </div>
        ) : list.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-gray-400">暂无记录</span>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 w-20">类型</th>
                  <th className="px-4 py-3 font-medium text-gray-600 w-28">操作</th>
                  <th className="px-4 py-3 font-medium text-gray-600 w-24">操作人</th>
                  <th className="px-4 py-3 font-medium text-gray-600">操作对象</th>
                  <th className="px-4 py-3 font-medium text-gray-600">详情</th>
                  <th className="px-4 py-3 font-medium text-gray-600 w-40">时间</th>
                  <th className="px-4 py-3 font-medium text-gray-600 w-28">IP</th>
                </tr>
              </thead>
              <tbody>
                {list.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[entry.type]}`}>
                        {TYPE_LABELS[entry.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{entry.action}</td>
                    <td className="px-4 py-3 text-gray-700">{entry.operator}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="font-medium">{entry.target}</span>
                      {entry.targetId && <span className="text-gray-400 ml-1 text-xs">({entry.targetId})</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={entry.detail}>
                      {entry.detail ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(entry.at)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{entry.ip ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  第 {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} 条，共 {total} 条
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, page - 2)
                    const p = start + i
                    if (p > totalPages) return null
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1 border rounded text-sm ${
                          p === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AuditLogList
