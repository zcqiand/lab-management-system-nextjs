"use client";

// M04.F06 型号维护 — CategoryDictList endpoint=/models（saas 菜单 m-models）
import { AppShell } from "@/components/app/app-shell";
import { CategoryDictList } from "@/features/dicts/CategoryDictList";

export default function Page() {
  return (
    <AppShell>
      <CategoryDictList
        endpoint="/models"
        title="型号维护"
        hint="InspectionModel 实体码表，按检测项目过滤；拖拽调整顺序"
        dataFn="M04.F06.I01"
        createDataFn="M04.F06.I02"
        editDataFn="M04.F06.I02"
        deleteDataFn="M04.F06.I03"
      />
    </AppShell>
  );
}
