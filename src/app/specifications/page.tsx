"use client";

// M04.F07 规格维护 — CategoryDictList endpoint=/specifications（saas 菜单 m-specs）
import { AppShell } from "@/components/app/app-shell";
import { CategoryDictList } from "@/features/dicts/CategoryDictList";

export default function Page() {
  return (
    <AppShell>
      <CategoryDictList
        endpoint="/specifications"
        title="规格维护"
        hint="InspectionSpec 实体码表，按检测项目过滤；拖拽调整顺序"
        dataFn="M04.F07.I01"
        createDataFn="M04.F07.I02"
        editDataFn="M04.F07.I02"
        deleteDataFn="M04.F07.I03"
      />
    </AppShell>
  );
}
