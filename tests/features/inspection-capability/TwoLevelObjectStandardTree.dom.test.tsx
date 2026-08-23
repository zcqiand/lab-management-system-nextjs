// REF tests/features/inspection-capability/TwoLevelObjectStandardTree.test.tsx 移植。
// 差异：
// - MemoryRouter 去除（组件不走路由，直接 render）；
// - server/setup 引用改本仓路径（../../setup.dom）；fnTest 路径同；
// - mock URL 改写：组件经 API_ROUTES 映射后实际请求 /api/* 路由--
//   /inspection-objects -> '*/api/inspection/objects'，/inspection-standards ->
//   '*/api/inspection/standards'，/inspection-calculation-methods -> '*/api/calculation-methods'，
//   /inspection-technical-requirements -> '*/api/technical-requirements'；
// - beforeEach 加范本模式（resetFixtures + installShapeAdapters）--测试内 server.use
//   覆盖发生在其后，LIFO 优先级保证 mock 生效。
import { describe, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../setup.dom";
import { resetFixtures, installShapeAdapters } from "../../helpers/seed";
import {
  TwoLevelObjectStandardTree,
  type TreeListItem,
} from "@/features/inspection-capability/TwoLevelObjectStandardTree";
import { fnTest } from "../../fn";

interface DemoItem extends TreeListItem {
  id: string;
  algorithmType: string;
  specimenCount: number;
}

const OBJECTS = [
  { id: "o1", code: "steel", name: "钢材", sortOrder: 1 },
  { id: "o2", code: "concrete", name: "混凝土", sortOrder: 2 },
] as never[];

const STANDARDS_BY_OBJECT: Record<string, never[]> = {
  steel: [
    { id: "s1", code: "GB/T 228.1-2021", name: "GB/T 228.1-2021", sortOrder: 1 },
    { id: "s2", code: "GB/T 232-2010", name: "GB/T 232-2010", sortOrder: 2 },
  ] as never[],
  concrete: [
    { id: "s3", code: "GB/T 50081-2019", name: "GB/T 50081-2019", sortOrder: 1 } as never,
  ],
};

beforeEach(() => {
  resetFixtures();
  installShapeAdapters(server);
  server.use(
    http.get("*/api/inspection/objects", () =>
      HttpResponse.json({
        items: OBJECTS,
        total: OBJECTS.length,
        page: 1,
        pageSize: 500,
      }),
    ),
  );
});

describe("TwoLevelObjectStandardTree 2 级树 + 拖拽列表", () => {
  fnTest(["M06.F05.I01"], "左树渲染检测项目", async () => {
    server.use(
      http.get("*/api/inspection/standards", () => HttpResponse.json({ items: [] })),
    );
    server.use(
      http.get("*/api/calculation-methods", () => HttpResponse.json({ items: [] })),
    );
    render(
      <TwoLevelObjectStandardTree<DemoItem>
        title="计算方法"
        listEndpoint="/inspection-calculation-methods"
        getItemId={(it) => it.id}
        columns={[{ key: "algorithmType", label: "类型", width: "w-24" }]}
        onCreate={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("object-steel")).toBeInTheDocument());
    expect(screen.getByTestId("object-concrete")).toBeInTheDocument();
  });

  fnTest(["M06.F05.I01"], "展开检测项目 -> 显示子级检测标准", async () => {
    server.use(
      http.get("*/api/inspection/standards", ({ request }) => {
        const url = new URL(request.url);
        const obj = url.searchParams.get("inspectionObjectCode");
        const items = (STANDARDS_BY_OBJECT[obj ?? ""] ?? []) as never[];
        return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 500 });
      }),
    );
    server.use(
      http.get("*/api/calculation-methods", () => HttpResponse.json({ items: [] })),
    );
    render(
      <TwoLevelObjectStandardTree<DemoItem>
        title="计算方法"
        listEndpoint="/inspection-calculation-methods"
        getItemId={(it) => it.id}
        columns={[{ key: "algorithmType", label: "类型", width: "w-24" }]}
        onCreate={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    await screen.findByTestId("object-steel");
    fireEvent.click(screen.getByTestId("object-steel"));
    await waitFor(() =>
      expect(screen.getByTestId("standard-GB/T 228.1-2021")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("standard-GB/T 232-2010")).toBeInTheDocument();
  });

  fnTest(
    ["M06.F05.I01"],
    "选中检测标准 -> 右侧展示列表 + sortOrder + 拖拽把手",
    async () => {
      server.use(
        http.get("*/api/inspection/standards", () =>
          HttpResponse.json({ items: STANDARDS_BY_OBJECT.steel }),
        ),
      );
      server.use(
        http.get("*/api/calculation-methods", () =>
          HttpResponse.json({
            items: [
              {
                id: "r1",
                algorithmType: "simple_avg",
                specimenCount: 3,
                sortOrder: 10,
                createdAt: "",
                updatedAt: "",
              },
              {
                id: "r2",
                algorithmType: "manual",
                specimenCount: 1,
                sortOrder: 20,
                createdAt: "",
                updatedAt: "",
              },
            ],
          }),
        ),
      );
      render(
        <TwoLevelObjectStandardTree<DemoItem>
          title="计算方法"
          listEndpoint="/inspection-calculation-methods"
          getItemId={(it) => it.id}
          columns={[{ key: "algorithmType", label: "类型", width: "w-24" }]}
          onCreate={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />,
      );
      await screen.findByTestId("object-steel");
      fireEvent.click(screen.getByTestId("object-steel"));
      await screen.findByTestId("standard-GB/T 228.1-2021");
      fireEvent.click(screen.getByTestId("standard-GB/T 228.1-2021"));
      await screen.findByTestId("row-r1");
      expect(screen.getByTestId("sort-r1")).toHaveTextContent("10");
      expect(screen.getByTestId("sort-r2")).toHaveTextContent("20");
      expect(screen.getByTestId("drag-handle-r1")).toBeInTheDocument();
      expect(screen.getByTestId("drag-handle-r2")).toBeInTheDocument();
    },
  );

  fnTest(
    ["M06.F06.I01"],
    "技术要求也复用：filterParam=judgmentStandardCode",
    async () => {
      server.use(
        http.get("*/api/inspection/standards", () =>
          HttpResponse.json({ items: STANDARDS_BY_OBJECT.steel }),
        ),
      );
      let lastFilter: string | null = null;
      server.use(
        http.get("*/api/technical-requirements", ({ request }) => {
          const url = new URL(request.url);
          lastFilter = url.searchParams.get("judgmentStandardCode");
          return HttpResponse.json({ items: [] });
        }),
      );
      render(
        <TwoLevelObjectStandardTree<DemoItem>
          title="技术要求"
          listEndpoint="/inspection-technical-requirements"
          listFilterParam="judgmentStandardCode"
          getItemId={(it) => it.id}
          columns={[{ key: "algorithmType", label: "类型", width: "w-24" }]}
          onCreate={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />,
      );
      await screen.findByTestId("object-steel");
      fireEvent.click(screen.getByTestId("object-steel"));
      await screen.findByTestId("standard-GB/T 228.1-2021");
      fireEvent.click(screen.getByTestId("standard-GB/T 228.1-2021"));
      await waitFor(() => expect(lastFilter).toBe("GB/T 228.1-2021"));
    },
  );

  fnTest(
    ["M06.F05.I01"],
    "计算方法：点击标准 -> 用 testingStandardCode 过滤 GET",
    async () => {
      server.use(
        http.get("*/api/inspection/standards", () =>
          HttpResponse.json({ items: STANDARDS_BY_OBJECT.steel }),
        ),
      );
      let lastFilter: string | null = null;
      let lastStandardInResponse: string | null = null;
      server.use(
        http.get("*/api/calculation-methods", ({ request }) => {
          const url = new URL(request.url);
          lastFilter = url.searchParams.get("testingStandardCode");
          // mock 返回：testingStandardCode 匹配的才返回（模拟真实后端过滤）
          const allItems = [
            {
              id: "r1",
              algorithmType: "simple_avg",
              specimenCount: 3,
              testingStandardCode: "GB/T 228.1-2021",
              sortOrder: 10,
              createdAt: "",
              updatedAt: "",
            },
            {
              id: "r2",
              algorithmType: "manual",
              specimenCount: 1,
              testingStandardCode: "GB/T 232-2010",
              sortOrder: 20,
              createdAt: "",
              updatedAt: "",
            },
          ];
          const items = lastFilter
            ? allItems.filter((r) => r.testingStandardCode === lastFilter)
            : [];
          lastStandardInResponse = items[0]?.testingStandardCode ?? null;
          return HttpResponse.json({ items });
        }),
      );
      render(
        <TwoLevelObjectStandardTree<DemoItem & { testingStandardCode?: string }>
          title="计算方法"
          listEndpoint="/inspection-calculation-methods"
          listFilterParam="testingStandardCode"
          getItemId={(it) => it.id}
          columns={[{ key: "algorithmType", label: "类型", width: "w-24" }]}
          onCreate={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />,
      );
      await screen.findByTestId("object-steel");
      fireEvent.click(screen.getByTestId("object-steel"));
      await screen.findByTestId("standard-GB/T 228.1-2021");

      // 1) 初次点击标准 -> GET ?testingStandardCode=GB/T 228.1-2021
      fireEvent.click(screen.getByTestId("standard-GB/T 228.1-2021"));
      await waitFor(() => expect(lastFilter).toBe("GB/T 228.1-2021"));
      await screen.findByTestId("row-r1");
      expect(lastStandardInResponse).toBe("GB/T 228.1-2021");

      // 2) 切换到另一个标准 -> GET 重新拉
      fireEvent.click(screen.getByTestId("standard-GB/T 232-2010"));
      await waitFor(() => expect(lastFilter).toBe("GB/T 232-2010"));
      await waitFor(() => expect(lastStandardInResponse).toBe("GB/T 232-2010"));
      await screen.findByTestId("row-r2");
      expect(screen.queryByTestId("row-r1")).not.toBeInTheDocument();
    },
  );

  fnTest(["M06.F05.I01"], "未选标准时右侧显示空态", async () => {
    server.use(
      http.get("*/api/inspection/standards", () => HttpResponse.json({ items: [] })),
    );
    server.use(
      http.get("*/api/calculation-methods", () => HttpResponse.json({ items: [] })),
    );
    render(
      <TwoLevelObjectStandardTree<DemoItem>
        title="计算方法"
        listEndpoint="/inspection-calculation-methods"
        getItemId={(it) => it.id}
        columns={[{ key: "algorithmType", label: "类型", width: "w-24" }]}
        onCreate={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    await screen.findByTestId("object-steel");
    await waitFor(() =>
      expect(screen.getByText("请先选择左侧检测项目下的检测标准")).toBeInTheDocument(),
    );
  });
});
