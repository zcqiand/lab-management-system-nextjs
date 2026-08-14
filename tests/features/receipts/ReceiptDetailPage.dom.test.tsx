import { describe, expect, beforeEach, vi } from 'vitest'
import { tablesOf, installShapeAdapters, resetFixtures } from '../../helpers/seed'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fnTest } from '../../fn'
import { server } from '../../setup.dom'

// next/navigation mock：ReceiptDetailPage 用 useParams 取路由参数（决策 F）。
// vi.hoisted 提供可变 mockParams，renderDetail(id) 前改值。
const mockParams = vi.hoisted(() => ({ id: 'rc-detail-1' }))
vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
}))

const { receiptTable, inspectionReportNameTable, inspectionParameterTable, inspectionStandardTable, inspectionStandardParameterTable, sampleTable, testRecordTable, paramInterfaceTable, inspectionParameterParamInterfaceTable } = tablesOf()
import { ReceiptDetailPage } from '@/features/receipts/ReceiptDetailPage'

const CATEGORY_NO_TPL = 'RN-TEST-NOTPL'

beforeEach(() => {
  cleanup()
  resetFixtures()
  installShapeAdapters(server)

  inspectionReportNameTable.insert({
    id: 'rn-notpl',
    code: CATEGORY_NO_TPL,
    name: '无模板报告类别',
    extFields: [],
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  } as never)
  inspectionParameterTable.insert({
    id: 'ip-1',
    code: 'IP-0001',
    name: '凝结时间',
    rawName: '凝结时间',
    canonicalName: '凝结时间',
    unit: 'min',
    aliases: [],
    sourceType: 'official',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  } as never)
  // 注入两条标准，详情页会用 code + name 渲染
  inspectionStandardTable.insert({
    id: 'std-50081',
    code: 'GB/T 50081-2019',
    name: '混凝土物理力学性能试验方法标准',
    status: 'active',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  } as never)
  inspectionStandardTable.insert({
    id: 'std-175',
    code: 'GB 175-2023',
    name: '通用硅酸盐水泥',
    status: 'active',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  } as never)
  receiptTable.insert({
    id: 'rc-detail-1',
    tenantId: 'TENANT-001',
    contractId: 'c1',
    commissionCode: 'RC-DETAIL-1',
    categoryCode: CATEGORY_NO_TPL,
    commissionDate: '2024-05-03',
    receivedBy: '王五',
    sampleSource: '施工送检',
    testCategory: '委托检验',
    testParameters: ['IP-0001'],
    judgmentBasis: ['GB/T 50081-2019'],
    testingBasis: ['GB/T 50081-2019', 'GB 175-2023'],
    remark: '',
    flowStatus: 'receiving',
    flowHistory: [],
    lastSubmittedBy: null,
    createdAt: '',
    updatedAt: '',
  } as never)

  // 详情页「检测数据」表：插入一个样品 + 两个 test-records（IP-0001 / IP-9999），
  // 接样单只声明 testParameters:['IP-0001']，详情页应只显示 IP-0001（过滤掉 IP-9999）。
  sampleTable.insert({
    id: 's-detail-1',
    tenantId: 'TENANT-001',
    receiptId: 'rc-detail-1',
    sampleCode: 'RC-DETAIL-1-S1',
    sampleName: '水泥',
    ext: {},
    createdAt: '',
    updatedAt: '',
  } as never)
  testRecordTable.insert({
    id: 'tr-detail-1',
    tenantId: 'TENANT-001',
    sampleId: 's-detail-1',
    parameterCode: 'IP-0001',
    requirement: '',
    result: '180',
    verdict: '合格',
    standardCode: 'GB/T 50081-2019',
    createdAt: '',
    updatedAt: '',
  } as never)

  // 参数界面（card 派发）：IP-0001 走 default 卡
  paramInterfaceTable.insert({
    id: 'pi-default',
    code: 'default',
    name: '默认四格卡',
    componentPath: 'default',
    description: '',
    sortOrder: 1,
    isOfficial: true,
    createdAt: '',
    updatedAt: '',
  } as never)
  inspectionParameterParamInterfaceTable.insert({
    id: 'pi-param-1',
    inspectionParameterCode: 'IP-0001',
    paramInterfaceCode: 'default',
    createdAt: '',
    updatedAt: '',
  } as never)
  // 标准 ↔ 参数关联，让 IP-0001 候选检测依据有 GB/T 50081-2019
  inspectionStandardParameterTable.insert({
    id: 'sp-1',
    inspectionStandardCode: 'GB/T 50081-2019',
    inspectionParameterCode: 'IP-0001',
    createdAt: '',
    updatedAt: '',
  } as never)
  testRecordTable.insert({
    id: 'tr-detail-9999',
    tenantId: 'TENANT-001',
    sampleId: 's-detail-1',
    parameterCode: 'IP-9999',
    requirement: '',
    result: '42',
    verdict: '合格',
    createdAt: '',
    updatedAt: '',
  } as never)
})

function renderDetail(id = 'rc-detail-1') {
  mockParams.id = id
  return render(<ReceiptDetailPage />)
}

describe('接样单详情页', () => {
  fnTest(['M03.F09.I03'], '详情页标题栏有「报告预览」按钮，点击打开预览弹窗', async () => {
    renderDetail()
    const btn = await screen.findByRole('button', { name: '报告预览' })
    expect(btn).toBeTruthy()

    const user = userEvent.setup()
    await user.click(btn)
    // 无 templatePath 的报告类别走「暂无报告模板」分支，证明弹窗已打开（AC-2/AC-3）
    await waitFor(() => {
      expect(screen.getByText(/暂无报告模板/)).toBeTruthy()
    })
  })

  fnTest(['M03.F09.I02'], '检测参数显示为 名称(单位)，无 IP- 前缀', async () => {
    renderDetail()
    // 凝结时间 → IP-0001 在 build 脚本里按规则推断为 min
    await waitFor(() => {
      expect(screen.getByText(/凝结时间\(min\)/)).toBeTruthy()
    })
    expect(screen.queryByText(/IP-0001-凝结时间/)).toBeNull()
  })

  fnTest(['M03.F09.I02'], '报告类别显示报告简称，不显示原始编码', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('无模板报告类别')).toBeTruthy()
    })
  })

  fnTest(
    ['M03.F09.I02'],
    '检测数据按 receipt.testParameters 过滤（IP-9999 不在白名单 → 不显示）',
    async () => {
      renderDetail()
      // 等卡片渲染：白名单 IP-0001 的 default 卡 + 卡片含「凝结时间(min)」
      await waitFor(() => {
        expect(screen.getByText(/凝结时间\(min\)/)).toBeTruthy()
        // 反向断言：IP-9999 不应在「检测参数」卡片标题里
        expect(screen.queryByText(/IP-9999/)).toBeNull()
      }, { timeout: 5000 })
    },
  )

  fnTest(
    ['M03.F09.I02'],
    '检测参数 card 只读：select/输入框 disabled（详情页只读模式）',
    async () => {
      renderDetail()
      // 等 default 卡渲染
      await waitFor(() => {
        expect(screen.getByText('检测依据', { exact: true })).toBeTruthy()
      }, { timeout: 5000 })
      // 3 个 select 都应该 disabled（只读：检测依据 / 技术要求 / 单项评定）
      const selects = document.querySelectorAll('select')
      expect(selects.length).toBeGreaterThanOrEqual(3)
      for (const s of Array.from(selects)) {
        expect((s as HTMLSelectElement).disabled).toBe(true)
      }
      // 检测结果 input 也应该 readOnly
      const input = document.querySelector('input[placeholder="录入检测结果"]') as HTMLInputElement | null
      expect(input).not.toBeNull()
      expect(input?.readOnly).toBe(true)
    },
  )

fnTest(
    ['M03.F09.I02'],
    '检测数据按参数界面派发：IP-0001 走 default 卡（4 格 + 检测依据 + 标准名称）',
    async () => {
      renderDetail()
      // 等 default 卡渲染——用「检测依据」label 作为锚点（仅 card 内的 label 命中此字串；
      // 页面头部的「检测依据：」是 SPAN 不匹配 exact '检测依据'）
      await waitFor(() => {
        expect(screen.getByText('检测依据', { exact: true })).toBeTruthy()
      }, { timeout: 5000 })
      // default 卡的 4 项 label：检测依据 / 技术要求 / 检测结果 / 单项评定
      // （getAllByText：详情页头部是「检测依据：」带冒号，exact 模式只匹配 card label）
      expect(screen.queryAllByText('检测依据', { exact: true }).length).toBe(1)
      expect(screen.queryAllByText('技术要求', { exact: true }).length).toBe(1)
      expect(screen.queryAllByText('检测结果', { exact: true }).length).toBe(1)
      expect(screen.queryAllByText('单项评定', { exact: true }).length).toBe(1)
      // 检测依据 select 应含 'GB/T 50081-2019 混凝土物理力学性能试验方法标准'
      // （getAllByText：详情页头部判定依据 + card 检测依据 都可能匹配）
      expect(
        screen.getAllByText(/GB\/T 50081-2019 混凝土物理力学性能试验方法标准/).length,
      ).toBeGreaterThanOrEqual(1)
      // 单项评定 select 应含「合格」（option 列表 + selected value 都会出现）
      expect(screen.getAllByText('合格').length).toBeGreaterThanOrEqual(1)
    },
  )

  fnTest(
    ['M03.F09.I02'],
    '判定依据 / 检测依据 显示「标准编号 + 标准名称」（不再只显示编码）',
    async () => {
      renderDetail()
      // 等数据加载
      await waitFor(() => {
        expect(screen.getByText('无模板报告类别')).toBeTruthy()
      })
      // 判定依据：GB/T 50081-2019 混凝土物理力学性能试验方法标准
      // （getAllByText：判定依据 + 检测依据各出现一次同名项）
      expect(
        screen.getAllByText('GB/T 50081-2019 混凝土物理力学性能试验方法标准').length,
      ).toBeGreaterThanOrEqual(1)
      // 检测依据：第二条标准带名称
      expect(
        screen.getByText(/GB 175-2023 通用硅酸盐水泥/),
      ).toBeTruthy()
      // 反向断言：旧行为只剩裸编码的行不应再出现
      const cellTexts = Array.from(
        document.querySelectorAll('.col-span-2'),
      ).map((el) => el.textContent ?? '')
      // 判定依据 / 检测依据 行不再只含纯编码（无空格分隔的名称）
      const jbCell = cellTexts.find((t) => t.startsWith('判定依据：'))
      const tbCell = cellTexts.find((t) => t.startsWith('检测依据：'))
      expect(jbCell).toContain('混凝土物理力学性能试验方法标准')
      expect(tbCell).toContain('通用硅酸盐水泥')
    },
  )
})
