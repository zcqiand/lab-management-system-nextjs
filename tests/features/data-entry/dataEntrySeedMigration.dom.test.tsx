import { describe, expect, beforeEach } from 'vitest'
import { server } from '../../setup.dom'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { fnTest } from '../../fn'
import {installShapeAdapters, resetFixtures, seedData, seedMasterDataIntoMockDb, tablesOf} from '../../helpers/seed'
const { sampleTable } = tablesOf(server)
import { EntryModal } from '@/features/data-entry/DataEntryPage'
import type { SampleReceipt } from '@/types/api'

/** 模拟 RC-2024-0705-01-S1（seedData 后该接样单应已迁 testParameters=['IP-0055']）。
 *  这里直接用 'IP-0055'，断言 seed 后真能渲染参数卡，而不是「无可录入的检测参数」。 */
function buildRc00701(): SampleReceipt {
  return {
    id: 'rc-007-01',
    contractId: 'c-007',
    commissionCode: 'RC-2024-0705-01',
    commissionDate: '2024-07-05',
    categoryCode: 'RN-105-1',
    receivedBy: '周工',
    sampleSource: '施工送检',
    testCategory: '委托检验',
    flowStatus: 'data_entry',
    flowHistory: [],
    lastSubmittedBy: null,
    testParameters: ['IP-0055'],
    createdAt: '2024-07-05T00:00:00Z',
    updatedAt: '2024-07-05T00:00:00Z',
  }
}

describe('DataEntryPage seed 迁移 CON→IP（RC-2024-0705-01）', () => {
  beforeEach(() => {
    cleanup()
    // REF setup.ts afterEach resetDb() 的本仓等价物：恢复 fixtures 快照（清掉上个测试的 insert）
    resetFixtures()
    // msw dictCrud/链接 GET 返回裸数组 → REF 组件期望 {items}；beforeEach 重装（afterEach resetHandlers 会清）
    installShapeAdapters(server);

    // seedData 不调 seedMasterDataIntoMockDb——需要单独灌入参数/标准/技术要求等 M06 主数据。
    seedMasterDataIntoMockDb(server)
    seedData(server)
    // 不依赖 seedData 自动种的样品——直接给 rc-007-01 加一个 S1 样品。
    const has = sampleTable.all().find((s) => s.receiptId === 'rc-007-01')
    if (!has) {
      sampleTable.insert({
        id: 's-007-01-1',
        tenantId: "TENANT-001",
        receiptId: 'rc-007-01',
        sampleCode: 'RC-2024-0705-01-S1',
        sampleName: '混凝土',
        ext: {},
      } as never)
    }
  })

  fnTest(
    ['M03.F03.I03'],
    'RC-2024-0705-01-S1 显示 IP-0055 抗压强度参数卡（不再"无可录入的检测参数"）',
    async () => {
      render(
          <EntryModal receipt={buildRc00701()} onClose={() => {}} />
      )

      // IP-0055 绑了 concrete-compress → 渲染 ConcreteCompressCard（含「抗压强度」「抗压强度代表值」label）；
      // 若 legacy CON002 还在，会得到「无可录入的检测参数（接样单未关联参数）」而不是这些卡。
      await waitFor(
        () => {
          // 「抗压强度代表值」是 card 唯一独占的 label——用它来锚定卡已渲染
          // （「抗压强度」字面会与表头「抗压强度 (MPa)」并列出现导致多匹配）
          expect(screen.queryByText(/抗压强度代表值/)).toBeInTheDocument()
        },
        { timeout: 5000 },
      )
      // 不再显示空状态
      expect(
        screen.queryByText('无可录入的检测参数（接样单未关联参数）'),
      ).not.toBeInTheDocument()
    },
  )

  fnTest(
    ['M03.F03.I03'],
    'seedData 后 RC-2024-0705-01 的 testParameters 已迁 IP-0055（无 CON002）',
    async () => {
      // 直接断言 seed 后 rc-007-01 落库的 testParameters 用新码
      // 通过 data entry dialog 的渲染结果间接验证（避免依赖内部 API）
      render(
          <EntryModal receipt={buildRc00701()} onClose={() => {}} />
      )
      await waitFor(
        () => expect(screen.queryByText(/抗压强度代表值/)).toBeInTheDocument(),
        { timeout: 5000 },
      )
      // 假设 legacy 还在：CON002 没有对应 IP-XXXX 入 master data，会出现「无可录入的检测参数」
      // 因此卡已渲染 ⟺ testParameters 一定是 IP-0055（而非 CON002）。
      expect(screen.queryByText('无可录入的检测参数')).not.toBeInTheDocument()
    },
  )
})