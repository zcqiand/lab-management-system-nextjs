"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// REF src/features/inspection-capability/TwoLevelObjectStandardTree.tsx 移植。
// 差异：apiClient → @/api/legacy-client + API_ROUTES（listEndpoint/objectsEndpoint/
// standardsEndpoint 由父组件传 REF 字面路由，经 route() 查 API_ROUTES 映射）。
import { apiClient, API_ROUTES } from "@/api/legacy-client";

/** REF 字面路由 → lab-msw 路由；未登记的回退原样（防御）。 */
function route(p: string): string {
  return (API_ROUTES as Record<string, string>)[p] ?? p;
}

/** 检测项目节点（1 级） */
export interface ObjectNode {
  id: string;
  code: string;
  name: string;
  sortOrder?: number;
}

/** 检测标准节点（2 级） */
export interface StandardNode {
  id: string;
  code: string;
  name: string;
  sortOrder?: number;
}

/** 右侧列表行（计算方法 / 技术要求） */
export interface TreeListItem {
  id: string;
  sortOrder?: number;
  [k: string]: unknown;
}

interface Props<T extends TreeListItem> {
  /** 列表 API 路径：inspection-calculation-methods / inspection-technical-requirements */
  listEndpoint: string;
  /** 列表 GET 过滤时使用的 query 参数名（不同时可定制；默认 testingStandardCode） */
  listFilterParam?: string;
  /** 检测项目 GET 路径（默认 /inspection-objects） */
  objectsEndpoint?: string;
  /** 检测标准 GET 路径（默认 /inspection-standards） */
  standardsEndpoint?: string;
  /** 列定义（按顺序渲染在「#」与「操作」之间） */
  columns: Array<{
    key: string;
    label: string;
    width: string;
    align?: "left" | "center" | "right";
    render?: (item: T) => React.ReactNode;
  }>;
  /** 新建按钮 data-fn */
  createDataFn?: string;
  /** 编辑按钮 data-fn */
  editDataFn?: string;
  /** 删除按钮 data-fn */
  deleteDataFn?: string;
  /** 标题 */
  title: string;
  /** 顶层 data-fn */
  dataFn?: string;
  /** "新建" 按钮 click 时调用（父组件负责弹窗） */
  onCreate: () => void;
  /** "编辑" 按钮 click 时调用 */
  onEdit: (item: T) => void;
  /** "删除" 按钮 click 时调用 */
  onDelete: (item: T) => void;
  /** 把右侧行 ID 提取出来（用于稳定可拖拽） */
  getItemId: (item: T) => string;
  /** 把行数据 PUT 时的 body 构造（默认透传 { sortOrder }） */
  buildPutBody?: (item: T, sortOrder: number) => Record<string, unknown>;
  /** 自定义排序键数组；默认 ['sortOrder']。传非默认时拖拽手柄自动隐藏 */
  sortBy?: string[];
  /** 父组件控制的选中标准（受控）；传 undefined 走内部状态 */
  selectedStandard?: string | null;
  /** 选中变更回调 */
  onSelectedStandardChange?: (code: string | null) => void;
  /** 列表加载完成回调（用于父组件拿到当前 list 引用） */
  onListLoaded?: (items: T[]) => void;
}

/**
 * 通用 2 级树（检测项目 → 检测标准）+ 拖拽列表。
 * 计算方法 / 技术要求 共用。
 */
export function TwoLevelObjectStandardTree<T extends TreeListItem>(props: Props<T>) {
  const {
    listEndpoint,
    listFilterParam = "testingStandardCode",
    objectsEndpoint = "/inspection-objects",
    standardsEndpoint = "/inspection-standards",
    columns,
    createDataFn,
    editDataFn,
    deleteDataFn,
    title,
    dataFn,
    onCreate,
    onEdit,
    onDelete,
    getItemId,
    buildPutBody,
    selectedStandard: selectedStandardProp,
    onSelectedStandardChange,
    onListLoaded,
    sortBy,
  } = props;

  const sortKeys = sortBy && sortBy.length > 0 ? sortBy : ["sortOrder"];
  const dragEnabled = sortKeys.length === 1 && sortKeys[0] === "sortOrder";

  const [objects, setObjects] = useState<ObjectNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [innerSelected, setInnerSelected] = useState<string | null>(null);
  const selectedStandard =
    selectedStandardProp !== undefined ? selectedStandardProp : innerSelected;
  const setSelectedStandard = (code: string | null) => {
    if (onSelectedStandardChange) onSelectedStandardChange(code);
    if (selectedStandardProp === undefined) setInnerSelected(code);
  };
  const [standardsByObject, setStandardsByObject] = useState<
    Record<string, StandardNode[]>
  >({});
  const [list, setList] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // 加载检测项目
  useEffect(() => {
    apiClient
      .get<{ items: ObjectNode[] }>(route(objectsEndpoint), {
        params: { page: "1", pageSize: "500" },
      })
      .then((r) => {
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setObjects(items);
      })
      .catch(() => {});
  }, [objectsEndpoint]);

  // 展开某个检测项目时，按需加载它下面的检测标准
  const ensureStandardsLoaded = (objectCode: string) => {
    if (standardsByObject[objectCode]) return;
    apiClient
      .get<{ items: StandardNode[] }>(route(standardsEndpoint), {
        params: { page: "1", pageSize: "500", inspectionObjectCode: objectCode },
      })
      .then((r) => {
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setStandardsByObject((prev) => ({ ...prev, [objectCode]: items }));
      })
      .catch(() => {
        setStandardsByObject((prev) => ({ ...prev, [objectCode]: [] }));
      });
  };

  const toggleExpand = (objectCode: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(objectCode)) next.delete(objectCode);
      else next.add(objectCode);
      return next;
    });
    ensureStandardsLoaded(objectCode);
  };

  // 选中标准后拉列表
  useEffect(() => {
    if (!selectedStandard) {
      setList([]);
      onListLoaded?.([]);
      return;
    }
    setLoading(true);
    setError(null);
    apiClient
      .get<{ items: T[] }>(route(listEndpoint), {
        params: { page: "1", pageSize: "500", [listFilterParam]: selectedStandard },
      })
      .then((res) => {
        let items: T[] = Array.isArray(res.data?.items) ? [...res.data.items] : [];
        // 排序：默认按 sortOrder；传 sortBy 时按指定键
        if (dragEnabled) {
          items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        } else {
          items.sort((a, b) => {
            for (const key of sortKeys) {
              const va = a[key as keyof T];
              const vb = b[key as keyof T];
              if (va === vb) continue;
              if (va == null) return 1;
              if (vb == null) return -1;
              if (typeof va === "number" && typeof vb === "number") return va - vb;
              return String(va) < String(vb) ? -1 : 1;
            }
            return 0;
          });
          // 按 sortBy 键去重（保留首条）
          const seen = new Set<string>();
          items = items.filter((it) => {
            const k = sortKeys
              .map((key) => String((it as Record<string, unknown>)[key] ?? ""))
              .join("|");
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        }
        setList(items);
        onListLoaded?.(items);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        onListLoaded?.([]);
      })
      .finally(() => setLoading(false));
    // onListLoaded 是回调引用，故意省略以避免无限重渲
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listEndpoint, listFilterParam, selectedStandard]);

  const selectedStandardObj = useMemo(() => {
    for (const arr of Object.values(standardsByObject)) {
      const found = arr.find((s) => s.code === selectedStandard);
      if (found) return found;
    }
    return null;
  }, [standardsByObject, selectedStandard]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = list.findIndex((i) => getItemId(i) === active.id);
    const newIndex = list.findIndex((i) => getItemId(i) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(list, oldIndex, newIndex);
    setList(next);
    try {
      await Promise.all(
        next.map((item, idx) => {
          const sortOrder = (idx + 1) * 10;
          const body = buildPutBody ? buildPutBody(item, sortOrder) : { sortOrder };
          return apiClient.put(`${route(listEndpoint)}/${getItemId(item)}`, body);
        }),
      );
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg ?? "排序保存失败");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" data-fn={dataFn}>
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold">{title}</h2>
        <button
          type="button"
          onClick={onCreate}
          data-fn={createDataFn}
          disabled={!selectedStandard}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          新建
        </button>
      </div>

      {error && (
        <div role="alert" className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[260px_1fr] gap-4 flex-1 min-h-0">
        {/* 左侧 2 级树 */}
        <aside className="bg-white rounded shadow overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b shrink-0">
            检测项目
          </div>
          <ul className="flex-1 overflow-y-auto min-h-0">
            {objects.length === 0 && (
              <li className="px-3 py-4 text-sm text-gray-400 text-center">
                暂无检测项目
              </li>
            )}
            {objects.map((o) => {
              const isOpen = expanded.has(o.code);
              const stds = standardsByObject[o.code] ?? [];
              return (
                <li key={o.code}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(o.code)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-1 hover:bg-gray-50 border-l-2 border-transparent"
                    data-testid={`object-${o.code}`}
                  >
                    <span className="text-gray-400 w-4">{isOpen ? "▾" : "▸"}</span>
                    <span className="truncate">{o.name}</span>
                  </button>
                  {isOpen && (
                    <ul className="bg-gray-50">
                      {stds.length === 0 && (
                        <li className="px-3 py-1.5 text-xs text-gray-400 pl-8">
                          加载中...
                        </li>
                      )}
                      {stds.map((s) => {
                        const active = s.code === selectedStandard;
                        return (
                          <li key={s.code}>
                            <button
                              type="button"
                              onClick={() => setSelectedStandard(s.code)}
                              data-testid={`standard-${s.code}`}
                              className={`w-full text-left pl-8 pr-3 py-1.5 text-xs flex items-center gap-1 ${
                                active
                                  ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
                                  : "hover:bg-white text-gray-600 border-l-2 border-transparent"
                              }`}
                            >
                              <span className="truncate font-mono">{s.code}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        {/* 右侧拖拽列表 */}
        <section className="bg-white rounded shadow overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b flex items-center justify-between shrink-0">
            <span>
              {selectedStandardObj ? (
                <>
                  <span className="text-gray-400">▸</span>
                  <span className="font-mono">{selectedStandardObj.code}</span>
                </>
              ) : (
                "请先选择左侧检测项目下的检测标准"
              )}
            </span>
            {list.length > 1 && (
              <span className="text-gray-400 font-normal">拖拽行调整顺序</span>
            )}
          </div>

          {loading && list.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">加载中...</div>
          )}
          {!loading && list.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              {selectedStandard ? "暂无数据" : "请先选择左侧检测标准"}
            </div>
          )}

          {list.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={list.map((i) => getItemId(i))}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex-1 overflow-auto min-h-0">
                  {/* 表头 */}
                  <div className="sticky top-0 z-10 flex items-center bg-gray-50 border-b px-3 py-2 text-xs font-semibold text-gray-600 min-w-max">
                    {dragEnabled && (
                      <span className="w-4 mr-2 shrink-0" aria-hidden="true" />
                    )}
                    <span className="w-12 text-center shrink-0">#</span>
                    {columns.map((c, i) => (
                      <span
                        key={i}
                        className={`${c.width} ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} truncate px-1 shrink-0`}
                      >
                        {c.label}
                      </span>
                    ))}
                    <span className="ml-auto pl-3 shrink-0">操作</span>
                  </div>
                  <ul data-testid={`${listEndpoint}-list`} className="min-w-max">
                    {list.map((item) => (
                      <SortableRow
                        key={getItemId(item)}
                        item={item}
                        getItemId={getItemId}
                        columns={columns}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        editDataFn={editDataFn}
                        deleteDataFn={deleteDataFn}
                        dragEnabled={dragEnabled}
                      />
                    ))}
                  </ul>
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>
    </div>
  );
}

function SortableRow<T extends TreeListItem>({
  item,
  getItemId,
  columns,
  onEdit,
  onDelete,
  editDataFn,
  deleteDataFn,
  dragEnabled = true,
}: {
  item: T;
  getItemId: (item: T) => string;
  columns: Array<{
    key: string;
    label: string;
    width: string;
    align?: "left" | "center" | "right";
    render?: (item: T) => React.ReactNode;
  }>;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  editDataFn?: string;
  deleteDataFn?: string;
  dragEnabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: getItemId(item) });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const id = getItemId(item);
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`row-${id}`}
      className={`flex items-center border-b last:border-b-0 px-3 py-2 text-sm bg-white ${
        isDragging ? "shadow-md z-10 relative" : "hover:bg-gray-50"
      }`}
    >
      {dragEnabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="拖拽手柄"
          data-testid={`drag-handle-${id}`}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mr-2 select-none shrink-0"
        >
          ⋮⋮
        </button>
      )}
      <span
        className="w-12 text-center text-xs text-gray-500 tabular-nums shrink-0"
        data-testid={`sort-${id}`}
      >
        {item.sortOrder ?? "-"}
      </span>
      {columns.map((c, i) => {
        const raw = c.render ? c.render(item) : (item as Record<string, unknown>)[c.key];
        const isEmpty = raw === "" || raw === undefined || raw === null;
        const display: string = isEmpty ? "—" : String(raw);
        return (
          <span
            key={i}
            className={`${c.width} ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} truncate px-1 text-gray-700 shrink-0`}
            title={display}
          >
            {display}
          </span>
        );
      })}
      <div className="ml-auto pl-3 space-x-2 whitespace-nowrap shrink-0">
        {/* @entry editDataFn / deleteDataFn 由父组件传入：计算方法 M06.F05.I02/I03，技术要求 M06.F06.I02/I03 */}
        <button
          onClick={() => onEdit(item)}
          data-fn={editDataFn}
          className="px-2 py-1 text-blue-600 hover:underline"
        >
          编辑
        </button>
        <button
          onClick={() => onDelete(item)}
          data-fn={deleteDataFn}
          className="px-2 py-1 text-red-600 hover:underline"
        >
          删除
        </button>
      </div>
    </li>
  );
}
