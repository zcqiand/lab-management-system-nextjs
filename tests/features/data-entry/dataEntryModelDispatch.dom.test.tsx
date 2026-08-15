import { describe, expect, beforeEach } from 'vitest'
import { server } from '../../setup.dom'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { fnTest } from '../../fn'
import {installShapeAdapters, resetFixtures, seedMasterDataIntoMockDb, seedParamInterfaces, tablesOf} from '../../helpers/seed'
const { sampleTable } = tablesOf(server)
import { EntryModal } from '@/features/data-entry/DataEntryPage'
import type { SampleReceipt } from '@/types/api'

/** 构造一个 data_entry 阶段的接样单（testParameters 同时含 已绑定界面的 IP-0055 与 未绑定的 IP-0001）。 */
function buildReceipt(): SampleReceipt {
  return {
    id: 'rc-dispatch-test',
    contractId: 'c-seed',
    commissionCode: 'RC-DISPATCH-01',
    commissionDate: '2024-07-01',
    categoryCode: 'RN-101',
    receivedBy: '检测员',
    sampleSource: '施工送检',
    testCategory: '委托检验',
    flowStatus: 'data_entry',
    flowHistory: [],
    lastSubmittedBy: null,
    testParameters: ['IP-0055', 'IP-0001'],
    createdAt: '2024-07-01T00:00:00Z',
    updatedAt: '2024-07-01T00:00:00Z',
  }
}

describe('DataEntryPage 按参数界面关联派发模型组件', () => {
  beforeEach(() => {
    cleanup()
    // REF setup.ts afterEach resetDb() 的本仓等价物：恢复 fixtures 快照（清掉上个测试的 insert）
    resetFixtures()
    // msw dictCrud/链接 GET 返回裸数组 → REF 组件期望 {items}；beforeEach 重装（afterEach resetHandlers 会清）
    installShapeAdapters(server);

    // seedData 不灌入 M06 主数据（参数/标准/技术要求/标准↔参数），需单独 seedMasterDataIntoMockDb；
    // seedParamInterfaces 提供 IP-0055↔concrete-compress 关联 + 默认四格卡界面。
    seedMasterDataIntoMockDb(server)
    seedParamInterfaces(server)
    // 为该接样单 seed 一个样品：EntryModal 打开后自动选中首样，参数卡才会渲染。
    sampleTable.insert({
      id: 's-dispatch-1',
      tenantId: "TENANT-001",
      receiptId: 'rc-dispatch-test',
      sampleCode: 'RC-DISPATCH-01-S1',
      sampleName: '水泥',
      ext: {},
    })
  })

  fnTest(['M03.F03.I03'], '按参数界面关联派发模型', async () => {
    const { container } = render(
        <EntryModal receipt={buildReceipt()} onClose={() => {}} />
    )

    // 等待参数卡渲染完成（IP-0001 默认卡的「单项评定」label 出现即代表数据已加载）
    await waitFor(() => {
      expect(screen.queryByText('单项评定')).toBeInTheDocument()
    })

    // (1) IP-0055 → ConcreteCompressCard：3 个「破坏荷载 (kN)」输入框（默认 specimenCount=3）
    const loadInputs = container.querySelectorAll(
      'input[type="number"][placeholder="破坏荷载 (kN)"]',
    )
    expect(loadInputs.length).toBe(3)

    // (2) 混凝土卡不渲染「单项评定」（按其设计：抗压强度按代表值评定，不在此卡判定）
    //     整页只有 IP-0001 的默认卡贡献「单项评定」，因此恰好 1 个。
    expect(screen.getAllByText('单项评定').length).toBe(1)

    // (3) IP-0001（未绑定界面）→ DefaultParamCard：四格齐全
    expect(screen.getByText('检测依据')).toBeTruthy()
    expect(screen.getByText('技术要求')).toBeTruthy()
    expect(screen.getByText('检测结果')).toBeTruthy()

    // (4) 数据录入不得删除/新增检测参数（只能改数据）——不出现「删除」按钮
    expect(screen.queryByText('删除')).not.toBeInTheDocument()
  })
})
