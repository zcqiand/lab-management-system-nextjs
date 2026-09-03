"use client";

// V016 菜单路径对齐：saas /me/menus 下发 lab 计算方法菜单 path=inspection-calculation-rules
// （m-calc-rules）。旧路径 /inspection-calculation-methods 保留，同渲染 CalculationMethodList。
// M06.F05 计算方法 — 二级树（检测项目→检测标准）+ 拖拽列表
import CalculationMethodList from "@/features/inspection-capability/CalculationMethodList";

export default function Page() {
  return <CalculationMethodList />;
}
