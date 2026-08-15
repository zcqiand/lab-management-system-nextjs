import { useCallback, useEffect, useMemo, useState } from "react";
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
import { apiClient, API_ROUTES } from "@/api/legacy-client";
import { ConfirmModal } from "@/components/ConfirmModal";

/** 型号/规格/等级/牌号 通用行结构（4 个 InspectionBrand/Model/Grade/Spec 共用） */
interface DictItem {
  id: string;
  code: string;
  name: string;
  inspectionObjectCode?: string;
  remark?: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

interface InspectionObject {
  code: string;
  name: string;
  sortOrder?: number;
}

interface Props {
  /** API_ROUTES 键：/models /specifications /grades /brands */
  endpoint: keyof typeof API_ROUTES;
  title: string;
  hint?: string;
  /** 功能 ID（用于 data-fn 入口标记），格式 Mxx.Fyy.Izz */
  dataFn?: string;
  /** 新建按钮 data-fn */
  createDataFn?: string;
  /** 编辑按钮 data-fn */
  editDataFn?: string;
  /** 删除按钮 data-fn */
  deleteDataFn?: string;
}

// @entry M04.F06.I01
// @entry M04.F07.I01
// @entry M04.F08.I01
// @entry M04.F09.I01
/**
 * 4 码表通用页（M04.F06/F07/F08/F09 I01）：
 * 左侧检测项目树（一级）+ 右侧可拖拽排序的列表。
 * 拖拽行后 PUT 持久化 sortOrder；新建项 sortOrder 自动续号。
 * 移植自 REF lab-management-system src/features/dicts/CategoryDictList.tsx。
 */
export function CategoryDictList({
  endpoint,
  title,
  hint,
  dataFn,
  createDataFn,
  editDataFn,
  deleteDataFn,
}: Props) {
  const [objects, setObjects] = useState<InspectionObject[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [list, setList] = useState<DictItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DictItem | null>(null);
  const [formObject, setFormObject] = useState("");
  const [formName, setFormName] = useState("");
  const [formRemark, setFormRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DictItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    apiClient
      .get<{ items: InspectionObject[] }>(API_ROUTES["/inspection-objects"], {
        params: { page: 1, pageSize: "200" },
      })
      .then((r) => {
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        // 检测项目按 sortOrder 升序展示
        items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setObjects(items);
        // 默认选中第一个
        setSelectedCode((prev) => prev ?? items[0]?.code ?? null);
      })
      .catch(() => {});
  }, []);

  const selectedObject = useMemo(
    () => objects.find((o) => o.code === selectedCode) ?? null,
    [objects, selectedCode],
  );

  const base = API_ROUTES[endpoint];

  const fetchList = useCallback(async () => {
    if (!selectedCode) {
      setList([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: DictItem[] }>(base, {
        params: { page: "1", pageSize: "200", inspectionObjectCode: selectedCode },
      });
      const items = [...(Array.isArray(res.data?.items) ? res.data.items : [])];
      items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setList(items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base, selectedCode]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openCreate = () => {
    setEditing(null);
    setFormObject(selectedCode ?? objects[0]?.code ?? "");
    setFormName("");
    setFormRemark("");
    setFormOpen(true);
  };

  const openEdit = (item: DictItem) => {
    setEditing(item);
    setFormObject(item.inspectionObjectCode ?? "");
    setFormName(item.name);
    setFormRemark(item.remark ?? "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formObject || !formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await apiClient.put(`${base}/${editing.id}`, {
          name: formName.trim(),
          remark: formRemark,
        });
      } else {
        await apiClient.post(base, {
          inspectionObjectCode: formObject,
          name: formName.trim(),
          remark: formRemark,
        });
      }
      setFormOpen(false);
      await fetchList();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`${base}/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchList();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  // 拖拽结束时：交换前端顺序 + 并行 PUT 所有受影响项的 sortOrder
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = list.findIndex((i) => i.id === active.id);
    const newIndex = list.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(list, oldIndex, newIndex);
    setList(next); // 立即反馈
    try {
      await Promise.all(
        next.map((item, idx) =>
          apiClient.put(`${base}/${item.id}`, { sortOrder: (idx + 1) * 10 }),
        ),
      );
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "排序保存失败");
      // 失败时回滚到服务端顺序
      await fetchList();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" data-fn={dataFn}>
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
        </div>
        <button
          onClick={openCreate}
          data-fn={createDataFn}
          disabled={!selectedCode && objects.length === 0}
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

      <div className="grid grid-cols-[240px_1fr] gap-4 flex-1 min-h-0">
        {/* 左侧：检测项目树 */}
        <aside className="bg-white rounded shadow overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b shrink-0">
            检测项目
          </div>
          <ul className="flex-1 overflow-y-auto min-h-0">
            {objects.length === 0 && (
              <li className="px-3 py-4 text-sm text-gray-400 text-center">暂无检测项目</li>
            )}
            {objects.map((o) => {
              const active = o.code === selectedCode;
              return (
                <li key={o.code}>
                  <button
                    type="button"
                    onClick={() => setSelectedCode(o.code)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-1 ${
                      active
                        ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
                        : "hover:bg-gray-50 text-gray-700 border-l-2 border-transparent"
                    }`}
                  >
                    <span className="text-gray-400">▸</span>
                    <span className="truncate">{o.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* 右侧：可拖拽列表 */}
        <section className="bg-white rounded shadow overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b flex items-center justify-between shrink-0">
            <span>
              {selectedObject ? (
                <>
                  <span className="text-gray-400">▸</span> {selectedObject.name}
                </>
              ) : (
                "请选择左侧检测项目"
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
              {selectedCode ? "暂无数据" : "请先选择左侧检测项目"}
            </div>
          )}

          {list.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={list.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul data-testid={`${String(endpoint)}-list`} className="flex-1 overflow-y-auto">
                  {list.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      editDataFn={editDataFn}
                      deleteDataFn={deleteDataFn}
                      onEdit={openEdit}
                      onDelete={(it) => setDeleteTarget(it)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>

      <ConfirmModal
        open={formOpen}
        title={`${editing ? "编辑" : "新建"}${title.replace(/(管理|维护)/, "")}`}
        message={
          <div className="space-y-3 text-left text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">检测项目</label>
              <select
                value={formObject}
                onChange={(e) => setFormObject(e.target.value)}
                disabled={Boolean(editing)}
                className="w-full border rounded px-2 py-1.5 disabled:bg-gray-100"
              >
                {objects.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">名称</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
              <input
                value={formRemark}
                onChange={(e) => setFormRemark(e.target.value)}
                className="w-full border rounded px-2 py-1.5"
              />
            </div>
          </div>
        }
        confirmText="保存"
        loading={saving}
        onConfirm={handleSave}
        onCancel={() => setFormOpen(false)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="删除确认"
        message={`确定删除「${deleteTarget?.name ?? ""}」？`}
        confirmText="确认"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/** 拖拽行：左把手 + 排序号 + 名称 + 备注 + 操作 */
function SortableRow({
  item,
  editDataFn,
  deleteDataFn,
  onEdit,
  onDelete,
}: {
  item: DictItem;
  editDataFn?: string;
  deleteDataFn?: string;
  onEdit: (item: DictItem) => void;
  onDelete: (item: DictItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`row-${item.id}`}
      className={`flex items-center border-b last:border-b-0 px-3 py-2 text-sm bg-white ${
        isDragging ? "shadow-md z-10 relative" : "hover:bg-gray-50"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="拖拽手柄"
        data-testid={`drag-handle-${item.id}`}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mr-2 select-none"
      >
        ⋮⋮
      </button>
      <span
        className="w-12 text-center text-xs text-gray-500 tabular-nums"
        data-testid={`sort-${item.id}`}
      >
        {item.sortOrder ?? "-"}
      </span>
      <span className="flex-1 truncate">{item.name}</span>
      <span className="flex-1 text-gray-500 truncate text-xs">{item.remark ?? ""}</span>
      <div className="space-x-2">
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

export default CategoryDictList;
