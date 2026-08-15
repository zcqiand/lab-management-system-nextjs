import { describe, it, expect } from 'vitest'
import { assembleReport, reportAxis, flattenForDocx, hasGridManifest } from '@/features/data-entry/reportTemplateData'
import type { SampleReceipt, Sample, TestRecord } from '@/types/api'

const receipt = (categoryCode: string): SampleReceipt =>
  ({
    id: 'r1',
    contractId: 'c1',
    commissionCode: 'RC-1',
    categoryCode,
    receivedBy: 'x',
    sampleSource: '施工送检',
    testCategory: '委托检验',
    flowStatus: 'data_entry',
    flowHistory: [],
    lastSubmittedBy: null,
    createdAt: '',
    updatedAt: '',
  }) as unknown as SampleReceipt // 仅测试：省略长串可选/默认字段

const sample = (id: string): Sample =>
  ({
    id,
    receiptId: 'r1',
    sampleCode: 'S1',
    sampleName: '样品',
    sampleQuantity: '1 组',
    remark: '',
  }) as Sample

describe('assembleReport', () => {
  it('reportAxis：RN-105-1/RN-108-2 试件轴，其余参数轴', () => {
    expect(reportAxis('RN-105-1')).toBe('specimen')
    expect(reportAxis('RN-108-2')).toBe('specimen')
    expect(reportAxis('RN-101')).toBe('parameter')
  })

  it('参数轴：items 行数 = 该 RN 参数关联数，六列非空', () => {
    const out = assembleReport({
      receipt: receipt('RN-101'),
      samples: [sample('s1')],
      records: [],
      org: null,
    })
    if (!('items' in out)) throw new Error('应为参数轴')
    expect(out.items.length).toBeGreaterThan(0)
    for (const it of out.items) {
      expect(it.xh.length).toBeGreaterThan(0)
      expect(it.mc.length).toBeGreaterThan(0)
      expect(it.jcz.length).toBeGreaterThan(0) // mock 回退保证非空
      expect(it.jd.length).toBeGreaterThan(0)
      // 检测依据 jcyj：无 per-param 检测标准时留空（不再用技术要求文案兜底，那是「技术要求」列）
      expect(it.jcyj).toBe('')
    }
  })

  it('mock 回退：无 TestRecord 时 jcz 仍非空', () => {
    const out = assembleReport({
      receipt: receipt('RN-101'),
      samples: [sample('s1')],
      records: [],
      org: null,
    })
    if ('items' in out)
      expect(out.items.every((i) => i.jcz.length > 0)).toBe(true)
  })

  it('试件轴：rows pad 到 15 行', () => {
    const out = assembleReport({
      receipt: receipt('RN-105-1'),
      samples: [sample('s1')],
      records: [],
      org: null,
    })
    if (!('rows' in out)) throw new Error('应为试件轴')
    expect(out.rows.length).toBe(15)
  })

  it('试件轴：IP-0055 result JSON 解析后每个样品 1 行，kyqd0/1/2 各 1 试件 + dbz 共享', () => {
    const recResult = JSON.stringify({
      loads: [120, 135, 150],
      strengths: [5.33, 6.0, 6.67],
      representative: 6.0,
    })
    const out = assembleReport({
      receipt: receipt('RN-105-1'),
      samples: [sample('s1')],
      records: [
        {
          id: 'tr-1',
          sampleId: 's1',
          parameterCode: 'IP-0055',
          requirement: '',
          result: recResult,
          verdict: '合格',
          createdAt: '',
          updatedAt: '',
        } as TestRecord,
      ],
      org: null,
    })
    if (!('rows' in out)) throw new Error('应为试件轴')
    expect(out.rows.length).toBe(15)
    // 1 个样品 = 1 行（占 1 个 vMerge 段，3 行高）：kyqd0/1/2 = 3 个试件各 1 值
    expect(out.rows[0]!.kyqd0).toBe('5.33')
    expect(out.rows[0]!.kyqd1).toBe('6')
    expect(out.rows[0]!.kyqd2).toBe('6.67')
    expect(out.rows[0]!.dbz).toBe('6')
    // 其他 8 列单值
    expect(out.rows[0]!.ybbh).toBe('S1')
    // padding from row 1
    expect(out.rows[1]!.kyqd0).toBe('')
    expect(out.rows[1]!.dbz).toBe('')
    // 反向断言：JSON 字符串不应出现在任何 cell
    const allText = out.rows.map((r) => r.kyqd0 + '|' + r.kyqd1 + '|' + r.kyqd2 + '|' + r.dbz).join('\n')
    expect(allText).not.toContain('{')
    expect(allText).not.toContain('"loads"')
  })

  it('试件轴：2 个样品 → 2 行 + 13 行 padding（每样品占 1 段）', () => {
    const rec = (result: string, sid: string) => ({
      id: `tr-${sid}`,
      sampleId: sid,
      parameterCode: 'IP-0055',
      requirement: '',
      result,
      verdict: '合格',
      createdAt: '',
      updatedAt: '',
    } as TestRecord)
    const out = assembleReport({
      receipt: receipt('RN-105-1'),
      samples: [sample('s1'), sample('s2')],
      records: [
        rec(JSON.stringify({ loads: [120, 135, 150], strengths: [5.33, 6.0, 6.67], representative: 6.0 }), 's1'),
        rec(JSON.stringify({ loads: [100, 110, 120], strengths: [4.44, 4.89, 5.33], representative: 4.89 }), 's2'),
      ],
      org: null,
    })
    if (!('rows' in out)) throw new Error('应为试件轴')
    expect(out.rows.length).toBe(15)
    // S1: row 0
    expect(out.rows[0]!.kyqd0).toBe('5.33')
    expect(out.rows[0]!.kyqd1).toBe('6')
    expect(out.rows[0]!.kyqd2).toBe('6.67')
    expect(out.rows[0]!.dbz).toBe('6')
    // S2: row 1
    expect(out.rows[1]!.kyqd0).toBe('4.44')
    expect(out.rows[1]!.kyqd1).toBe('4.89')
    expect(out.rows[1]!.kyqd2).toBe('5.33')
    expect(out.rows[1]!.dbz).toBe('4.89')
    // padding from row 2
    expect(out.rows[2]!.kyqd0).toBe('')
    expect(out.rows[14]!.dbz).toBe('')
  })

  it('试件轴：result 不是 JSON 时回退原样（不抛错）', () => {
    const out = assembleReport({
      receipt: receipt('RN-105-1'),
      samples: [sample('s1')],
      records: [
        {
          id: 'tr-1',
          sampleId: 's1',
          parameterCode: 'IP-0055',
          requirement: '',
          result: '老字符串值',
          verdict: '合格',
          createdAt: '',
          updatedAt: '',
        } as TestRecord,
      ],
      org: null,
    })
    if (!('rows' in out)) throw new Error('应为试件轴')
    expect(out.rows.length).toBe(15)
    // 1 行回退（原 result 字符串原样作为单值试件）+ 14 行 padding
    expect(out.rows[0]!.kyqd0).toBe('老字符串值')
    expect(out.rows[0]!.kyqd1).toBe('老字符串值')
    expect(out.rows[0]!.kyqd2).toBe('老字符串值')
    expect(out.rows[0]!.dbz).toBe('老字符串值')
    expect(out.rows[1]!.kyqd0).toBe('')
  })
})

describe('flattenForDocx', () => {
  it('RN-105-1 抗压走 grid 模式（flattenForDocx 走 cell 展开；不再原样返回 rows）', () => {
    const out = assembleReport({ receipt: receipt('RN-105-1'), samples: [sample('s1')], records: [], org: null })
    const flat = flattenForDocx('RN-105-1', '105_混凝土抗压强度检测报告', out, [sample('s1')]) as Record<string, unknown>
    // grid 模式：rows 不在顶层；per-row tag p<pos>_<field> 已展开为 flat dict
    expect('rows' in flat).toBe(false)
    expect(typeof flat.p0_ybbh).toBe('string')
    expect(typeof flat.p0_kyqd0).toBe('string')
    expect(typeof flat.p0_kyqd1).toBe('string')
    expect(typeof flat.p0_kyqd2).toBe('string')
    expect(typeof flat.p1_ybbh).toBe('string') // 段 2（r4）已注入
    expect(typeof flat.p4_ybbh).toBe('string') // 段 5（r13）已注入
  })

  it('RN-101 grid：扁平字典含 manifest tag + 通用表头 + 样品摘要；param 回退非空', () => {
    expect(hasGridManifest('101_水泥检测报告')).toBe(true)
    const out = assembleReport({ receipt: receipt('RN-101'), samples: [sample('s1')], records: [], org: null })
    const flat = flattenForDocx('RN-101', '101_水泥检测报告', out, [sample('s1')]) as Record<string, string>
    // manifest cell tag（比表面积行）
    expect(flat.r9_jcz).toBeTruthy()
    expect(flat.r9_jd).toBe('合格')
    // 通用表头（段落 tag）
    expect(typeof flat.wtdw).toBe('string')
    // 样品摘要
    expect(flat.ypbh).toBe('S1')
    // 氧化镁含量行现为真实关联参数 IP-0554（param 源回退非空、确定性）
    expect(flat.r16_jcz).toBeTruthy()
    expect(flat.r16_jd).toBe('合格')
  })

  it('mock 源确定性', () => {
    const out = assembleReport({ receipt: receipt('RN-101'), samples: [sample('s1')], records: [], org: null })
    const a = flattenForDocx('RN-101', '101_水泥检测报告', out, [sample('s1')]) as Record<string, string>
    const b = flattenForDocx('RN-101', '101_水泥检测报告', out, [sample('s1')]) as Record<string, string>
    expect(a.r16_jcz).toBe(b.r16_jcz)
  })

  it('强度类参数：单个强度值 {qd*_N} 从 result JSON 逐格填充；技术要求 {r*_jz} 取要求文案', () => {
    const strengthRec = {
      id: 't1',
      sampleId: 's1',
      parameterCode: 'IP-0556', // 3 天抗压强度（qd3y）
      requirement: '≥ 17',
      result: JSON.stringify({
        loads: [33, 34, 35, 33.5, 34.5, 35.5],
        strengths: [20.6, 21.3, 21.9, 20.9, 21.6, 22.2],
        kept: [true, true, true, true, true, true],
        mean: 21.4,
        invalid: false,
      }),
      verdict: '合格',
      createdAt: '',
      updatedAt: '',
    } as TestRecord
    const out = assembleReport({
      receipt: receipt('RN-101'),
      samples: [sample('s1')],
      records: [strengthRec],
      org: null,
    })
    const flat = flattenForDocx('RN-101', '101_水泥检测报告', out, [sample('s1')]) as Record<string, string>
    // 6 个单个强度值逐格
    expect(flat.qd3y_0).toBe('20.6')
    expect(flat.qd3y_3).toBe('20.9')
    expect(flat.qd3y_5).toBe('22.2')
    // 平均值 + 技术要求
    expect(flat.qd3y_avg).toBe('21.4')
    expect(flat.r20_jz).toBe('≥ 17')
    // 无记录的抗折(qd3z)单值 → 空内容按约定打印「—」，不残留 {tag}
    expect(flat.qd3z_0).toBe('—')
  })

  it('record:<code>:<jsonPath> 语法：从 TestRecord.result JSON 解析任意字段（REQ-2026-015 钢筋焊接 4 试件 × 3 次试验取数）', () => {
    // 用一个 ad-hoc manifest（不走真实模板文件）验证 source resolver。
    // 这里直接借 101 模板的 grid 走默认流程；record 解析是按 record.result JSON，与 manifest tag 无关。
    const tensileRec = {
      id: 't-tensile',
      sampleId: 's1',
      parameterCode: 'IP-0087',
      requirement: '',
      result: JSON.stringify({
        diameter: 25,
        techReqLabel: '≥ 540 MPa',
        loads: [270, 268, 272],
        strengths: [550, 546, 554.1],
        fractureDistances: [50, 55, 45],
        fractureCharacteristics: ['母材断裂', '母材断裂', '焊缝断裂'],
      }),
      verdict: '',
      createdAt: '',
      updatedAt: '',
    } as TestRecord
    // 用 RN-102-3（102_钢筋焊接接头检测报告）走 grid，manifest 里的 record: 源应解析出扁平 JSON 字段。
    // 抗拉卡（IP-0087）扁平：diameter/techReqLabel/strengths[0..2]/fractureDistances/fractureCharacteristics 都在 record 顶层；
    // 弯曲卡（IP-0155）走 specimens[] 数组（沿用旧布局）。
    const bendRec = {
      id: 't-bend',
      sampleId: 's1',
      parameterCode: 'IP-0155',
      requirement: '',
      result: JSON.stringify({
        angles: [90, 90, 90],
        results: ['合格', '合格', '合格'],
      }),
      verdict: '',
      createdAt: '',
      updatedAt: '',
    } as TestRecord
    const out = assembleReport({
      receipt: receipt('RN-102-3'),
      samples: [sample('s1')],
      records: [tensileRec, bendRec],
      org: null,
    })
    const flat = flattenForDocx(
      'RN-102-3',
      '102_钢筋焊接接头检测报告',
      out,
      [sample('s1')],
      [tensileRec, bendRec],
    ) as Record<string, string>
    expect(flat.s1_jcz0).toBe('550')
    expect(flat.s1_jl0).toBe('50')
    expect(flat.s1_tz0).toBe('母材断裂')
    expect(flat.s1_jz).toBe('≥ 540 MPa')
    expect(flat.s1_wq0).toBe('合格')
  })
})
