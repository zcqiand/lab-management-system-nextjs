"use client";

// M02.F01 合同管理 — 列表 + Dialog 弹窗（新建/编辑）+ 行内删除
//
// UI 模式（对齐 REF ContractList）：
//   - 顶部筛选条（status select / keyword input）
//   - 表格：合同编号 / 项目名称 / 委托单位 / 见证人 / 状态 / 委托日期
//   - 「新建」按钮 → Dialog 弹窗（覆盖在表格之上）
//   - 编辑按钮 → Dialog 弹窗（预填该行）
//   - 删除按钮 → confirm + 调 DELETE

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useContracts,
  useCreateContract,
  useDeleteContract,
  useUpdateContract,
  type Contract,
} from "@/api/contracts";

type Mode = { kind: "idle" } | { kind: "create" } | { kind: "edit"; id: string };

const EMPTY_BODY: Omit<Contract, "id" | "tenantId" | "createdAt" | "updatedAt"> = {
  contractCode: "",
  clientUnit: "",
  projectName: "",
  constructionUnit: "",
  witnessUnit: "",
  witness: "",
  status: "active",
};

export default function ContractsPage() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "idle" });

  const filters = {
    status: status || undefined,
    keyword: keyword || undefined,
  };
  const list = useContracts(filters);
  const create = useCreateContract();
  const update = useUpdateContract(mode.kind === "edit" ? mode.id : "");
  const remove = useDeleteContract();

  const items = list.data?.items ?? [];

  const editingContract =
    mode.kind === "edit" ? (items.find((c) => c.id === mode.id) ?? null) : null;

  return (
    <>
      <ContractsHeader onNew={() => setMode({ kind: "create" })} />
      <ContractsFilters
        status={status}
        keyword={keyword}
        onStatusChange={setStatus}
        onKeywordChange={setKeyword}
      />

      {/* 新建 Dialog */}
      <Dialog
        open={mode.kind === "create"}
        onOpenChange={(open) => {
          if (!open) setMode({ kind: "idle" });
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建合同</DialogTitle>
            <DialogDescription>创建一条合同记录（带 * 字段必填）。</DialogDescription>
          </DialogHeader>
          <ContractFormBody
            submitting={create.isPending}
            error={create.error?.message}
            onSubmit={(body) =>
              create.mutate(body, {
                onSuccess: () => {
                  toast.success("合同已创建");
                  setMode({ kind: "idle" });
                },
                onError: (err) => toast.error(err.message),
              })
            }
          />
        </DialogContent>
      </Dialog>

      {/* 编辑 Dialog */}
      <Dialog
        open={mode.kind === "edit"}
        onOpenChange={(open) => {
          if (!open) setMode({ kind: "idle" });
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingContract ? `编辑合同 ${editingContract.contractCode}` : "编辑合同"}
            </DialogTitle>
            <DialogDescription>修改合同字段后保存。</DialogDescription>
          </DialogHeader>
          {editingContract && (
            <ContractFormBody
              initial={editingContract}
              submitting={update.isPending}
              error={update.error?.message}
              onSubmit={(body) =>
                update.mutate(body, {
                  onSuccess: () => {
                    toast.success("合同已更新");
                    setMode({ kind: "idle" });
                  },
                  onError: (err) => toast.error(err.message),
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            合同列表（{list.data?.total ?? "…"}）
          </CardTitle>
          {list.isFetching && <span className="text-xs text-slate-400">加载中…</span>}
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">合同编号</th>
                <th className="px-4 py-2 text-left">项目名称</th>
                <th className="px-4 py-2 text-left">委托单位</th>
                <th className="px-4 py-2 text-left">见证人</th>
                <th className="px-4 py-2 text-left">状态</th>
                <th className="px-4 py-2 text-left">委托日期</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !list.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    （无数据）
                  </td>
                </tr>
              )}
              {items.map((c) => (
                <tr key={c.id} data-fn="M02.F01.I01" className="border-t hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{c.contractCode}</td>
                  <td className="px-4 py-2">{c.projectName}</td>
                  <td className="px-4 py-2">{c.clientUnit}</td>
                  <td className="px-4 py-2">{c.witness}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {c.entrustedDate ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMode({ kind: "edit", id: c.id });
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2 text-red-600 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确认删除合同 ${c.contractCode}？`)) {
                          remove.mutate(c.id, {
                            onSuccess: () => {
                              toast.success("合同已删除");
                            },
                            onError: (err) => toast.error(err.message),
                          });
                        }
                      }}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function ContractsHeader({ onNew }: { onNew: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">合同管理</h1>
        <p className="text-sm text-slate-500">
          M02.F01 合同 CRUD 与工程信息维护（数据来自 lab-msw fixtures）
        </p>
      </div>
      <Button onClick={onNew} data-fn="M02.F01.I02">
        新建合同
      </Button>
    </div>
  );
}

function ContractsFilters({
  status,
  keyword,
  onStatusChange,
  onKeywordChange,
}: {
  status: string;
  keyword: string;
  onStatusChange: (v: string) => void;
  onKeywordChange: (v: string) => void;
}) {
  return (
    <div className="mb-4 flex gap-2">
      <select
        className="border rounded h-9 px-2 text-sm bg-white"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="">全部状态</option>
        <option value="active">在用</option>
        <option value="archived">已归档</option>
      </select>
      <Input
        className="max-w-sm"
        placeholder="按合同编号 / 项目名称搜索"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "archived" }) {
  if (status === "active") {
    return (
      <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
        在用
      </span>
    );
  }
  return (
    <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
      已归档
    </span>
  );
}

type ContractBody = Omit<Contract, "id" | "createdAt" | "updatedAt">;

function ContractFormBody({
  initial,
  submitting,
  error,
  onSubmit,
}: {
  initial?: Contract;
  submitting: boolean;
  error?: string;
  onSubmit: (body: ContractBody) => void;
}) {
  const [body, setBody] = useState<ContractBody>(
    initial ?? {
      ...EMPTY_BODY,
      tenantId: "TENANT-001",
    },
  );

  function patch<K extends keyof ContractBody>(key: K, value: ContractBody[K]) {
    setBody((b) => ({ ...b, [key]: value }));
  }

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-2">提交失败：{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
        <Field
          label="合同编号 *"
          value={body.contractCode}
          onChange={(v) => patch("contractCode", v)}
        />
        <Field
          label="委托单位 *"
          value={body.clientUnit}
          onChange={(v) => patch("clientUnit", v)}
        />
        <Field
          label="项目名称 *"
          value={body.projectName}
          onChange={(v) => patch("projectName", v)}
        />
        <Field
          label="项目地点"
          value={body.projectLocation ?? ""}
          onChange={(v) => patch("projectLocation", v)}
        />
        <Field
          label="施工单位 *"
          value={body.constructionUnit}
          onChange={(v) => patch("constructionUnit", v)}
        />
        <Field
          label="检测专项"
          value={body.inspectionSpecialtyCode ?? ""}
          onChange={(v) => patch("inspectionSpecialtyCode", v)}
        />
        <Field
          label="建设单位"
          value={body.buildingUnit ?? ""}
          onChange={(v) => patch("buildingUnit", v)}
        />
        <Field
          label="监理单位"
          value={body.supervisorUnit ?? ""}
          onChange={(v) => patch("supervisorUnit", v)}
        />
        <Field
          label="检测人"
          value={body.inspectionPerson ?? ""}
          onChange={(v) => patch("inspectionPerson", v)}
        />
        <Field
          label="检测人电话"
          value={body.inspectionPhone ?? ""}
          onChange={(v) => patch("inspectionPhone", v)}
        />
        <Field
          label="见证单位 *"
          value={body.witnessUnit}
          onChange={(v) => patch("witnessUnit", v)}
        />
        <Field
          label="见证人 *"
          value={body.witness}
          onChange={(v) => patch("witness", v)}
        />
        <Field
          label="见证人电话"
          value={body.witnessPhone ?? ""}
          onChange={(v) => patch("witnessPhone", v)}
        />
        <Field
          label="联系人"
          value={body.contactPerson ?? ""}
          onChange={(v) => patch("contactPerson", v)}
        />
        <Field
          label="联系人电话"
          value={body.contactPhone ?? ""}
          onChange={(v) => patch("contactPhone", v)}
        />
        <Field
          label="委托日期 (YYYY-MM-DD)"
          value={body.entrustedDate ?? ""}
          onChange={(v) => patch("entrustedDate", v)}
        />
        <div>
          <Label>状态</Label>
          <select
            className="border rounded h-9 px-2 text-sm bg-white w-full"
            value={body.status}
            onChange={(e) => patch("status", e.target.value as "active" | "archived")}
          >
            <option value="active">在用</option>
            <option value="archived">已归档</option>
          </select>
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit(body)}
          data-fn="M02.F01.I03"
        >
          {submitting ? "提交中…" : initial ? "保存" : "创建"}
        </Button>
      </DialogFooter>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
