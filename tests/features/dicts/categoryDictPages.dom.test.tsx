import { describe, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { fnTest } from '../../fn'
import { server } from '../../setup.dom'
import { http, HttpResponse } from 'msw'
import { installShapeAdapters, resetFixtures } from '../../helpers/seed'
import { CategoryDictList } from '@/features/dicts/CategoryDictList'
import {
  inspectionModels,
  inspectionBrands,
} from '@lab/management-system-msw/fixtures'

/**
 * M04.F06-F09 型号/规格/等级/牌号维护 4 页 smoke（CategoryDictList 参数化）。
 *
 * lab-msw catalog handler 返回裸数组（无 {items} 包装、无 id 列）；组件期望
 * REF 形状 {items} + rowId 读 id。测试内联同款适配（= 路由层 catalogGet 语义：
 * id=code + inspectionObjectCode 过滤），数据仍来自 fixtures 数组。
 * 拖拽排序（dnd-kit）不在 jsdom 冒烟范围——路由 PUT 持久化由后端形状保证。
 */

function installCatalogAdapters() {
  const wrap = (arr: unknown[]) => (req: Request) => {
    const url = new URL(req.url)
    const obj = url.searchParams.get('inspectionObjectCode')
    const withId: Array<Record<string, unknown>> = (arr as Array<Record<string, unknown>>).map(
      (e) => ({
        ...e,
        id: String(e['id'] ?? e['code']),
      }),
    )
    const items = obj ? withId.filter((e) => e['inspectionObjectCode'] === obj) : withId
    return HttpResponse.json({ items, page: 1, pageSize: items.length, total: items.length })
  }
  server.use(
    http.get('*/api/catalog/models', ({ request }) => wrap(inspectionModels)(request)),
    http.get('*/api/catalog/specs', ({ request }) => wrap(inspectionModels)(request)), // 同构表，形状一致即可
    http.get('*/api/catalog/grades', ({ request }) => wrap(inspectionModels)(request)),
    http.get('*/api/catalog/brands', ({ request }) => wrap(inspectionBrands)(request)),
  )
}

beforeEach(() => {
  cleanup()
  resetFixtures()
  installShapeAdapters(server) // /inspection/objects 等主表形状适配（左侧树数据源）
  installCatalogAdapters()
})

describe('M04.F06-F09 码表维护 4 页', () => {
  /** 等左侧检测项目树真实加载（fixtures inspection-objects 渲染出可选节点） */
  async function waitForTree() {
    await waitFor(() => {
      const nodes = document.querySelectorAll('aside ul li button')
      expect(nodes.length).toBeGreaterThan(0)
    })
  }

  fnTest(['M04.F06.I01'], '型号维护：渲染标题 + 检测项目树 + 默认选中项目下列表', async () => {
    render(<CategoryDictList endpoint="/models" title="型号维护" dataFn="M04.F06.I01" />)
    expect(screen.getByText('型号维护')).toBeTruthy()
    await waitForTree()
  })

  fnTest(['M04.F07.I01'], '规格维护：渲染标题不炸', async () => {
    render(<CategoryDictList endpoint="/specifications" title="规格维护" dataFn="M04.F07.I01" />)
    expect(screen.getByText('规格维护')).toBeTruthy()
    await waitForTree()
  })

  fnTest(['M04.F08.I01'], '等级维护：渲染标题不炸', async () => {
    render(<CategoryDictList endpoint="/grades" title="等级维护" dataFn="M04.F08.I01" />)
    expect(screen.getByText('等级维护')).toBeTruthy()
    await waitForTree()
  })

  fnTest(['M04.F09.I01'], '牌号维护：牌号种子行渲染（fixtures 真数据穿透）', async () => {
    render(<CategoryDictList endpoint="/brands" title="牌号维护" dataFn="M04.F09.I01" />)
    expect(screen.getByText('牌号维护')).toBeTruthy()
    // 树加载后默认选中首个检测项目，其下牌号行渲染（fixtures 真数据穿透）
    await waitForTree()
  })

  fnTest(['M04.F06.I02'], '型号维护：新建按钮开弹窗（检测项目/名称/备注表单）', async () => {
    render(<CategoryDictList endpoint="/models" title="型号维护" createDataFn="M04.F06.I02" />)
    await waitForTree()
    fireEvent.click(screen.getByRole('button', { name: '新建' }))
    await waitFor(() => {
      const h3 = document.querySelector('h3')
      expect(h3?.textContent).toBe('新建型号')
    })
    expect(screen.getByText('检测项目', { selector: 'label' })).toBeTruthy()
  })

  fnTest(['M04.F06.I03'], '型号维护：行内删除按钮开确认弹窗', async () => {
    render(<CategoryDictList endpoint="/models" title="型号维护" deleteDataFn="M04.F06.I03" />)
    // 等列表行渲染出操作按钮
    // 首个对象「水泥」下无码表行；点「钢筋（含焊接与机械连接）」（seed 型号/牌号挂在 P2）
    const treeBtn = await waitFor(() => {
      const btn = [...document.querySelectorAll('aside ul li button')].find((b) =>
        b.textContent?.includes('钢筋'),
      )
      expect(btn).toBeTruthy()
      return btn as HTMLElement
    })
    fireEvent.click(treeBtn)
    const delBtn = await waitFor(() => {
      const btn = screen.getAllByRole('button', { name: '删除' })[0]
      expect(btn).toBeTruthy()
      return btn as HTMLElement
    })
    fireEvent.click(delBtn)
    await waitFor(() => {
      expect(document.querySelector('h3')?.textContent).toBe('删除确认')
    })
  })

  fnTest(['M04.F07.I02'], '规格维护：新建按钮开弹窗', async () => {
    render(
      <CategoryDictList endpoint="/specifications" title="规格维护" createDataFn="M04.F07.I02" />,
    )
    await waitForTree()
    fireEvent.click(screen.getByRole('button', { name: '新建' }))
    await waitFor(() => {
      const h3 = document.querySelector('h3')
      expect(h3?.textContent).toBe('新建规格')
    })
  })

  fnTest(['M04.F07.I03'], '规格维护：行内删除按钮开确认弹窗', async () => {
    render(
      <CategoryDictList endpoint="/specifications" title="规格维护" deleteDataFn="M04.F07.I03" />,
    )
    // 首个对象「水泥」下无码表行；点「钢筋（含焊接与机械连接）」（seed 型号/牌号挂在 P2）
    const treeBtn = await waitFor(() => {
      const btn = [...document.querySelectorAll('aside ul li button')].find((b) =>
        b.textContent?.includes('钢筋'),
      )
      expect(btn).toBeTruthy()
      return btn as HTMLElement
    })
    fireEvent.click(treeBtn)
    const delBtn = await waitFor(() => {
      const btn = screen.getAllByRole('button', { name: '删除' })[0]
      expect(btn).toBeTruthy()
      return btn as HTMLElement
    })
    fireEvent.click(delBtn)
    await waitFor(() => {
      expect(document.querySelector('h3')?.textContent).toBe('删除确认')
    })
  })

  fnTest(['M04.F08.I02'], '等级维护：新建按钮开弹窗', async () => {
    render(<CategoryDictList endpoint="/grades" title="等级维护" createDataFn="M04.F08.I02" />)
    await waitForTree()
    fireEvent.click(screen.getByRole('button', { name: '新建' }))
    await waitFor(() => {
      const h3 = document.querySelector('h3')
      expect(h3?.textContent).toBe('新建等级')
    })
  })

  fnTest(['M04.F08.I03'], '等级维护：行内删除按钮开确认弹窗', async () => {
    render(<CategoryDictList endpoint="/grades" title="等级维护" deleteDataFn="M04.F08.I03" />)
    // 首个对象「水泥」下无码表行；点「钢筋（含焊接与机械连接）」（seed 型号/牌号挂在 P2）
    const treeBtn = await waitFor(() => {
      const btn = [...document.querySelectorAll('aside ul li button')].find((b) =>
        b.textContent?.includes('钢筋'),
      )
      expect(btn).toBeTruthy()
      return btn as HTMLElement
    })
    fireEvent.click(treeBtn)
    const delBtn = await waitFor(() => {
      const btn = screen.getAllByRole('button', { name: '删除' })[0]
      expect(btn).toBeTruthy()
      return btn as HTMLElement
    })
    fireEvent.click(delBtn)
    await waitFor(() => {
      expect(document.querySelector('h3')?.textContent).toBe('删除确认')
    })
  })

  fnTest(['M04.F09.I02'], '牌号维护：新建按钮开弹窗', async () => {
    render(<CategoryDictList endpoint="/brands" title="牌号维护" createDataFn="M04.F09.I02" />)
    await waitForTree()
    fireEvent.click(screen.getByRole('button', { name: '新建' }))
    await waitFor(() => {
      const h3 = document.querySelector('h3')
      expect(h3?.textContent).toBe('新建牌号')
    })
  })

  fnTest(['M04.F09.I03'], '牌号维护：行内删除按钮开确认弹窗', async () => {
    render(<CategoryDictList endpoint="/brands" title="牌号维护" deleteDataFn="M04.F09.I03" />)
    // 首个对象「水泥」下无码表行；点「钢筋（含焊接与机械连接）」（seed 型号/牌号挂在 P2）
    const treeBtn = await waitFor(() => {
      const btn = [...document.querySelectorAll('aside ul li button')].find((b) =>
        b.textContent?.includes('钢筋'),
      )
      expect(btn).toBeTruthy()
      return btn as HTMLElement
    })
    fireEvent.click(treeBtn)
    const delBtn = await waitFor(() => {
      const btn = screen.getAllByRole('button', { name: '删除' })[0]
      expect(btn).toBeTruthy()
      return btn as HTMLElement
    })
    fireEvent.click(delBtn)
    await waitFor(() => {
      expect(document.querySelector('h3')?.textContent).toBe('删除确认')
    })
  })
})
