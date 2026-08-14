"use client";

// 运行时后端切换器（msw / aspnetcore / springboot / nextjs）。
// Mirror saas-react/backend-switcher.tsx。Next.js 端放在 src/components/app/ 而非 src/app/ 下。

import { useState } from "react";

const LABELS: Record<"msw" | "aspnetcore" | "springboot" | "nextjs", string> = {
  msw: "MSW（浏览器内 Mock）",
  aspnetcore: "ASP.NET Core",
  springboot: "Spring Boot",
  nextjs: "Next.js API（本仓 API routes）",
};

const SHORT: Record<"msw" | "aspnetcore" | "springboot" | "nextjs", string> = {
  msw: "MSW Mock",
  aspnetcore: "ASP.NET Core",
  springboot: "Spring Boot",
  nextjs: "Next.js API",
};

import type { BackendMode } from "@/api/backend-config";
import { useBackend } from "@/state/backend-context";

export function BackendSwitcher() {
  const { backend, baseUrls, setBackend, setBaseUrl, resetBaseUrls } = useBackend();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BackendMode | null>(null);
  const [draft, setDraft] = useState("");

  function startEdit(mode: BackendMode) {
    setEditing(mode);
    setDraft(baseUrls[mode]);
  }

  function commitEdit() {
    if (editing) {
      const trimmed = draft.trim().replace(/\/+$/, "");
      if (trimmed) setBaseUrl(editing, trimmed);
    }
    setEditing(null);
  }

  return (
    <div className="border rounded p-2 text-sm bg-white">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs">backend:</span>
        <strong data-testid="backend-switcher-trigger" data-fn="M98.F01.I01">
          {SHORT[backend]}
        </strong>
        <button className="ml-auto text-xs underline" onClick={() => setOpen((o) => !o)}>
          {open ? "close" : "switch"}
        </button>
      </div>
      {open ? (
        <div className="mt-2 space-y-2">
          {(Object.keys(LABELS) as BackendMode[]).map((mode) => (
            <button
              key={mode}
              data-testid={`backend-option-${mode}`}
              onClick={() => setBackend(mode)}
              className={`block w-full text-left px-2 py-1 rounded ${
                mode === backend ? "bg-blue-100" : "hover:bg-gray-100"
              }`}
            >
              <div className="font-medium">{LABELS[mode]}</div>
              <div className="font-mono text-xs text-gray-500 truncate">
                {baseUrls[mode] || "(同源)"}
              </div>
            </button>
          ))}
          <div className="border-t pt-2">
            {editing ? (
              <div className="space-y-1">
                <div className="text-xs font-medium">{LABELS[editing]}</div>
                <input
                  className="border rounded px-2 py-1 text-xs w-full font-mono"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(null)} className="text-xs underline">
                    cancel
                  </button>
                  <button onClick={commitEdit} className="text-xs underline">
                    save
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {(Object.keys(LABELS) as BackendMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => startEdit(mode)}
                    className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100"
                  >
                    <span className="font-medium">{LABELS[mode]}</span>
                    <span className="ml-2 font-mono text-gray-500">
                      {baseUrls[mode] || "(空 / 同源)"}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => resetBaseUrls()}
                  className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500"
                >
                  reset baseUrls
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
