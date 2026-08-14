import { describe, expect, beforeEach } from 'vitest'
import { tablesOf, installShapeAdapters, resetFixtures } from '../../helpers/seed'
import { http, HttpResponse } from 'msw'
import { server } from '../../setup.dom'
import { useReceiptStore } from '@/state/receiptStore'
import { resetApiClient } from '@/api/legacy-client'
const { receiptTable, inspectionReportNameTable } = tablesOf()
import { fnTest } from '../../fn'

function seedCategory(code = 'steel') {
  if (!inspectionReportNameTable.all().some((c) => c.code === code)) {
    inspectionReportNameTable.insert({
      id: `insp-rptn-${code}`,
      code,
      name: '钢材',
      summaryName: '钢材试验报告汇总表',
      extFields: [],
      sortOrder: 0,
    } as never)
  }
}

beforeEach(() => {
  localStorage.clear()
  resetFixtures()
  installShapeAdapters(server)
  receiptTable.reset()
  inspectionReportNameTable.reset()
  seedCategory()
  useReceiptStore.setState({ list: [], total: 0, current: null, loading: false, error: null })
  resetApiClient()
})

function insertReceipt(overrides: Partial<{
  id: string; contractId: string; commissionCode: string; receivedBy: string;
  sampleSource: string; testCategory: string; categoryCode: string
}> = {}) {
  receiptTable.insert({
    id: overrides.id ?? `rc-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: 'TENANT-001',
    contractId: overrides.contractId ?? 'contract-bj-001',
    commissionCode: overrides.commissionCode ?? 'RC-TEST-001',
    categoryCode: overrides.categoryCode ?? 'steel',
    commissionDate: '2024-05-03',
    receivedBy: overrides.receivedBy ?? '王五',
    sampleSource: overrides.sampleSource ?? '施工送检',
    testCategory: overrides.testCategory ?? '委托检验',
    remark: '',
    flowStatus: 'receiving',
    flowHistory: [],
    lastSubmittedBy: null,
  } as never)
}

describe('receiptStore 状态流转', () => {
  fnTest(['M03.F01.I01'], '初始状态', () => {
    const s = useReceiptStore.getState()
    expect(s.list).toEqual([])
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
  })

  fnTest(['M03.F01.I01'], 'fetchReceipts 成功', async () => {
    insertReceipt({ commissionCode: 'RC-001' })
    insertReceipt({ commissionCode: 'RC-002' })
    insertReceipt({ commissionCode: 'RC-003' })
    const promise = useReceiptStore.getState().fetchReceipts({ page: 1, pageSize: 10 })
    expect(useReceiptStore.getState().loading).toBe(true)
    await promise
    const s = useReceiptStore.getState()
    expect(s.loading).toBe(false)
    expect(s.list).toHaveLength(3)
    expect(s.total).toBe(3)
    expect(s.error).toBeNull()
  })

  fnTest(['M03.F01.I01'], 'fetchReceipts 支持 keyword 搜索', async () => {
    insertReceipt({ commissionCode: 'RC-KEYWORD-XYZ' })
    insertReceipt({ commissionCode: 'RC-OTHER' })
    await useReceiptStore.getState().fetchReceipts({ page: 1, pageSize: 10, keyword: 'XYZ' })
    const s = useReceiptStore.getState()
    expect(s.list).toHaveLength(1)
    expect(s.list[0]!.commissionCode).toContain('XYZ')
  })

  fnTest(['M03.F01.I01'], 'fetchReceipts 支持 categoryCode 过滤', async () => {
    seedCategory('cement')
    insertReceipt({ commissionCode: 'RC-STATUS-1', categoryCode: 'cement' })
    insertReceipt({ commissionCode: 'RC-STATUS-2', categoryCode: 'steel' })
    await useReceiptStore.getState().fetchReceipts({ page: 1, pageSize: 10, categoryCode: 'cement' })
    const s = useReceiptStore.getState()
    expect(s.list).toHaveLength(1)
    expect(s.list[0]!.categoryCode).toBe('cement')
  })

  fnTest(['M03.F01.I01'], 'fetchReceipts 空列表场景', async () => {
    await useReceiptStore.getState().fetchReceipts({ page: 1, pageSize: 10 })
    const s = useReceiptStore.getState()
    expect(s.list).toHaveLength(0)
    expect(s.total).toBe(0)
    expect(s.loading).toBe(false)
  })

  fnTest(['M03.F01.I01'], 'fetchReceipts 网络错误', async () => {
    server.use(http.get('*/api/receipts', () => HttpResponse.error()))
    await useReceiptStore.getState().fetchReceipts({ page: 1, pageSize: 10 })
    const s = useReceiptStore.getState()
    expect(s.loading).toBe(false)
    expect(s.error).toBeTruthy()
    expect(s.list).toEqual([])
  })

  fnTest(['M03.F01.I02'], 'createReceipt 成功', async () => {
    insertReceipt({ commissionCode: 'RC-SEED-001' })
    await useReceiptStore.getState().fetchReceipts({ page: 1, pageSize: 10 })
    await useReceiptStore.getState().createReceipt({
      contractId: 'contract-bj-001',
      commissionCode: 'RC-NEW-001',
      categoryCode: 'steel',
      receivedBy: '王五',
      sampleSource: '施工送检',
      testCategory: '委托检验',
    })
    const s = useReceiptStore.getState()
    expect(s.list.some((r) => r.commissionCode === 'RC-NEW-001')).toBe(true)
    expect(s.total).toBe(2)
  })

  fnTest(['M03.F01.I02'], 'createReceipt 失败', async () => {
    server.use(http.post('*/api/receipts', () => HttpResponse.error()))
    await useReceiptStore.getState().createReceipt({
      contractId: '',
      commissionCode: '',
      categoryCode: '',
      receivedBy: '',
      sampleSource: '',
      testCategory: '',
    })
    const s = useReceiptStore.getState()
    expect(s.error).toBeTruthy()
  })

  fnTest(['M03.F01.I03'], 'updateReceipt 成功', async () => {
    insertReceipt({ id: 'rc-update-test', commissionCode: 'RC-UPD-001' })
    await useReceiptStore.getState().fetchReceipts({ page: 1, pageSize: 10 })
    const target = useReceiptStore.getState().list[0]!
    await useReceiptStore.getState().updateReceipt(target.id, { receivedBy: '李四', remark: '复检' })
    const s = useReceiptStore.getState()
    const updated = s.list.find((r) => r.id === target.id)
    expect(updated?.receivedBy).toBe('李四')
    expect(updated?.remark).toBe('复检')
  })

  fnTest(['M03.F01.I03'], 'updateReceipt 不存在时 upsert 由 msw 404 → error（REF 语义差异见任务报告）', async () => {
    // msw PUT /receipts/:id 对不存在 id 返回 404（REF 旧 msw 是 upsert）。
    // store 行为：error 填充、不抛出——断言 error 非空即「不报错地失败」。
    await useReceiptStore.getState().updateReceipt('rc-upsert-test', { receivedBy: '测试员' })
    expect(useReceiptStore.getState().error).toBeTruthy()
  })

  fnTest(['M03.F01.I04'], 'deleteReceipt 成功', async () => {
    insertReceipt({ id: 'rc-del-1', commissionCode: 'RC-DEL-1' })
    insertReceipt({ id: 'rc-del-2', commissionCode: 'RC-DEL-2' })
    await useReceiptStore.getState().fetchReceipts({ page: 1, pageSize: 10 })
    const target = useReceiptStore.getState().list[0]!
    await useReceiptStore.getState().deleteReceipt(target.id)
    const s = useReceiptStore.getState()
    expect(s.list.some((r) => r.id === target.id)).toBe(false)
    expect(s.total).toBe(1)
  })

  fnTest(['M03.F01.I04'], 'deleteReceipt 不存在', async () => {
    await useReceiptStore.getState().deleteReceipt('nonexistent')
    expect(useReceiptStore.getState().error).toBeTruthy()
  })

  fnTest(['M03.F01.I01'], 'clearError', async () => {
    await useReceiptStore.getState().deleteReceipt('nonexistent')
    expect(useReceiptStore.getState().error).toBeTruthy()
    useReceiptStore.getState().clearError()
    expect(useReceiptStore.getState().error).toBeNull()
  })
})
