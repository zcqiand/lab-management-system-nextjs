import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import type { SampleReceipt, Sample, TestRecord, OrgInfo } from '@/types/api'
import { assembleReport, flattenForDocx, hasGridManifest } from '@/features/data-entry/reportTemplateData'

// 集成验证：对每份带 grid manifest 的模板，用 mock 数据装配 → docxtemplater 渲染，
// 断言不抛错（未定义 tag 会被 docxtemplater 默认抛出）且输出无残留 {tag}。
// 这是从注入到预览的端到端等价链路，新增模板只要写 manifest 即自动纳入。

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
  }) as unknown as SampleReceipt

const sample = (id: string): Sample =>
  ({
    id,
    receiptId: 'r1',
    sampleCode: 'S-101-01',
    sampleName: '水泥',
    sampleQuantity: '1 组',
    model: 'P·O 42.5',
    specification: '',
    manufacturer: '某水泥厂',
    structuralPart: '主体结构',
    batchNumber: 'PC2024001',
    arrivalDate: '2024-06-01',
  }) as unknown as Sample

const org = { orgName: '某某检测公司' } as OrgInfo

// 本仓模板在 public/templates/（Task 4 MANIFEST_BY_BASENAME + URL 同源）；
// REF 是 <repo>/data/templates/。
const TEMPLATES_DIR = resolve(__dirname, '../../../public/templates')

/** 读 generated inspection-report-name.json，取 (RN → templatePath) 且带 manifest 的模板。 */
import generatedReportNames from '@/data/generated/inspection-report-name.json'
const RN_TO_TEMPLATE: Array<{ code: string; path: string }> = (
  generatedReportNames as Array<{ code: string; templatePath?: string }>
)
  .filter((r): r is { code: string; templatePath: string } => !!r.templatePath)
  .map((r) => ({ code: r.code, path: r.templatePath! }))

const GRID_TEMPLATES = RN_TO_TEMPLATE.filter((t) => {
  const basename = t.path.replace(/\.docx$/, '')
  return hasGridManifest(basename)
})
const LOOP_TEMPLATES = RN_TO_TEMPLATE.filter((t) => {
  const basename = t.path.replace(/\.docx$/, '')
  return !hasGridManifest(basename)
})

describe('报告模板 grid 渲染（注入 → 装配 → docxtemplater）', () => {
  it('至少 101 已纳入（保证测试集非空）', () => {
    expect(GRID_TEMPLATES.some((t) => t.code === 'RN-101')).toBe(true)
  })

  for (const t of GRID_TEMPLATES) {
    it(`${t.code} 渲染无未定义 tag、无残留 {tag}`, () => {
      const docxPath = resolve(TEMPLATES_DIR, t.path)
      const buf = readFileSync(docxPath)
      const zip = new PizZip(buf)
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
      const rec: TestRecord[] = []
      const structured = assembleReport({
        receipt: receipt(t.code),
        samples: [sample('s1')],
        records: rec,
        org,
      })
      const flat = flattenForDocx(t.code, t.path.replace(/\.docx$/, ''), structured, [
        sample('s1'),
      ])
      // docxtemplater 默认对未定义 tag 抛错；这里期望不抛
      doc.render(flat)
      const out = doc.getZip().generate({ type: 'string' })
      // 残留未替换的占位符（{ 后跟字母）说明 tag 未提供
      expect(out).not.toMatch(/\{[a-z][a-z0-9_]*\}/)
    })
  }
})

describe('报告模板 loop/specimen 渲染（108 等）', () => {
  it('108-2 仍走 loop/specimen 路径（无 grid manifest）', () => {
    const codes = new Set(LOOP_TEMPLATES.map((t) => t.code))
    expect(codes.has('RN-108-2')).toBe(true)
    // RN-105-1 已切到 grid 模式（2026-07-25 重做：2 段合并单元格按 row:N:field 填）
    expect(codes.has('RN-105-1')).toBe(false)
  })

  for (const t of LOOP_TEMPLATES) {
    it(`${t.code} 渲染无未定义 tag、无残留 {tag}`, () => {
      const docxPath = resolve(TEMPLATES_DIR, t.path)
      const buf = readFileSync(docxPath)
      const zip = new PizZip(buf)
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
      const structured = assembleReport({
        receipt: receipt(t.code),
        samples: [sample('s1')],
        records: [],
        org,
      })
      // loop/specimen 模板无 manifest，flattenForDocx 原样返回结构化对象
      const data = flattenForDocx(t.code, t.path.replace(/\.docx$/, ''), structured, [
        sample('s1'),
      ])
      doc.render(data)
      const out = doc.getZip().generate({ type: 'string' })
      expect(out).not.toMatch(/\{[a-z][a-z0-9_]*\}/)
    })
  }
})
