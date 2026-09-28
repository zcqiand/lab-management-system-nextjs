// POST /api/auth/native-login
//
// M01.F05.I06 原生登录（REQ-2026-003 Q4-C，2026-09-28 人裁 A+B+C）：非浏览器
// 客户端（iOS/Android 原生表单）密码通道。校验与签发口径与 /api/auth/login
// 完全同源（directory 校验 + LabJwtSigner 真 HS256 + 服务账号菜单快照），
// 直接复用其 POST 处理器——两路径行为永不分叉。
export { POST } from "../login/route";
