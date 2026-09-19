import { PageLoading } from "@/components/app/page-loading";

// B6 加载态：(console) 路由组段级 loading —— 页面 chunk/数据流切换期间右内容区
// 显示整页加载态，不渲染空白。页面内数据级门控见各页面（PageLoading 同款）。
export default function ConsoleLoading() {
  return <PageLoading />;
}
