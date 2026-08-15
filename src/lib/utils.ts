// React 端 cn() 工具 —— 与 saas / Vue 仓 1:1 对称。
// shadcn-ui 组件统一用这个函数做 className 合并 + Tailwind 冲突去重。
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
