import { useEffect, useState, type FormEvent } from 'react'
import type { Sample } from '@/types/api'

export interface SampleFormValues {
  id?: string
  receiptId?: string
  sampleCode: string
  sampleName?: string
  model?: string
  specification?: string
  grade?: string
  brand?: string
  manufacturer?: string
  structuralPart?: string
  representQuantity?: string
  sampleQuantity?: string
  remark?: string
  projectId: string
}

interface SampleFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues?: Partial<Sample>
  onSubmit: (values: SampleFormValues) => void
  onCancel: () => void
  loading?: boolean
}

/**
 * 样品表单弹窗：create 与 edit 复用同一组件，由 mode 区分。
 * 包含公共属性：生产厂家、结构部位、代表数量。
 */
export function SampleFormModal({
  open,
  mode,
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
}: SampleFormModalProps) {
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [manufacturer, setManufacturer] = useState(initialValues?.manufacturer ?? '')
  const [structuralPart, setStructuralPart] = useState(initialValues?.structuralPart ?? '')
  const [representQuantity, setRepresentQuantity] = useState(initialValues?.representQuantity ?? '')
  const [errors, setErrors] = useState<{ projectId?: string; name?: string; code?: string }>({})

  useEffect(() => {
    if (open) {
      setProjectId('')
      setName(initialValues?.sampleName ?? '')
      setCode(initialValues?.sampleCode ?? '')
      setManufacturer(initialValues?.manufacturer ?? '')
      setStructuralPart(initialValues?.structuralPart ?? '')
      setRepresentQuantity(initialValues?.representQuantity ?? '')
      setErrors({})
    }

  }, [open, initialValues])

  if (!open) return null

  const title = mode === 'create' ? '新建样品' : '编辑样品'

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!projectId.trim()) next.projectId = '请输入所属项目'
    if (!name.trim()) next.name = '请输入样品名称'
    if (!code.trim()) next.code = '请输入样品编号'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const values: SampleFormValues = {
      ...(mode === 'edit' && initialValues?.id ? { id: initialValues.id } : {}),
      projectId: projectId.trim(),
      sampleName: name.trim(),
      sampleCode: code.trim(),
      manufacturer: manufacturer.trim() || undefined,
      structuralPart: structuralPart.trim() || undefined,
      representQuantity: representQuantity.trim() || undefined,
    }
    onSubmit(values)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-140 max-w-[90vw]">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="sample-project" className="block text-sm mb-1 font-medium">所属项目</label>
            <input
              id="sample-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.projectId && <p className="text-red-600 text-xs mt-1">{errors.projectId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sample-name" className="block text-sm mb-1 font-medium">样品名称</label>
              <input
                id="sample-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="sample-code" className="block text-sm mb-1 font-medium">样品编号</label>
              <input
                id="sample-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.code && <p className="text-red-600 text-xs mt-1">{errors.code}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="sample-mfr" className="block text-sm mb-1 font-medium">生产厂家</label>
              <input
                id="sample-mfr"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="如：沙钢集团"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="sample-struct" className="block text-sm mb-1 font-medium">结构部位</label>
              <input
                id="sample-struct"
                value={structuralPart}
                onChange={(e) => setStructuralPart(e.target.value)}
                placeholder="如：一层柱A-3"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="sample-rep-qty" className="block text-sm mb-1 font-medium">代表数量</label>
              <input
                id="sample-rep-qty"
                value={representQuantity}
                onChange={(e) => setRepresentQuantity(e.target.value)}
                placeholder="如：60t、200个"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-3 flex justify-end gap-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SampleFormModal
