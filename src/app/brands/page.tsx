"use client";

// M04.F09 牌号维护 — CategoryDictList endpoint=/brands（saas 菜单 m-brands）
import { AppShell } from "@/components/app/app-shell";
import { CategoryDictList } from "@/features/dicts/CategoryDictList";

export default function Page() {
  return (
    <AppShell>
      <CategoryDictList
        endpoint="/brands"
        title="牌号维护"
        hint="InspectionBrand 实体码表，按检测项目过滤；拖拽调整顺序"
        dataFn="M04.F09.I01"
        createDataFn="M04.F09.I02"
        editDataFn="M04.F09.I02"
        deleteDataFn="M04.F09.I03"
      />
    </AppShell>
  );
}
