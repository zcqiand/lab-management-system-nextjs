"use client";

// M04.F08 等级维护 — CategoryDictList endpoint=/grades（saas 菜单 m-grades）
import { CategoryDictList } from "@/features/dicts/CategoryDictList";

export default function Page() {
  return (
      <CategoryDictList
        endpoint="/grades"
        title="等级维护"
        hint="InspectionGrade 实体码表，按检测项目过滤；拖拽调整顺序"
        dataFn="M04.F08.I01"
        createDataFn="M04.F08.I02"
        editDataFn="M04.F08.I02"
        deleteDataFn="M04.F08.I03"
      />
  );
}
