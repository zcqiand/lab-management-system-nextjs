// Wraps the orval-generated handlers array with a stable `handlers` export.
// orval emits getTitleMock() as a default factory. Custom deterministic
// handlers (handlers-extra) take precedence over orval-generated faker handlers.
//
// 2026-08-27：过滤 getAuthLoginMockHandler + getAuthGetMenusMockHandler，
// 这两个端点由 extra 接管（密码登录服务账号快照 + miss 503 菜单语义），
// orval 的 faker 兜底会抢走并破坏 dev 体验。
// 2026-09-14：过滤 param-interfaces 全组 8 个 faker handler——该端点组由
// extra 的 fixture 确定性实现接管（REQ-2026-001 契约路径收敛；faker 随机数据
// + delay(1000) 会破坏 dev 确定性与前端 dom 测试 waitFor 超时）。
import {
  getAuthGetMenusMockHandler,
  getAuthLoginMockHandler,
  getParamInterfacesCreateParamInterfaceMockHandler,
  getParamInterfacesDeleteParamInterfaceMockHandler,
  getParamInterfacesGetParamInterfaceMockHandler,
  getParamInterfacesLinkParamInterfaceMockHandler,
  getParamInterfacesListParamInterfaceLinksMockHandler,
  getParamInterfacesListParamInterfacesMockHandler,
  getParamInterfacesUnlinkParamInterfaceMockHandler,
  getParamInterfacesUpdateParamInterfaceMockHandler,
  getTitleMock,
} from "./handlers.msw.msw";
import { extraHandlers } from "./handlers-extra";

const OVERRIDDEN_BY_EXTRA = new Set([
  getAuthGetMenusMockHandler(),
  getAuthLoginMockHandler(),
  getParamInterfacesListParamInterfacesMockHandler(),
  getParamInterfacesCreateParamInterfaceMockHandler(),
  getParamInterfacesGetParamInterfaceMockHandler(),
  getParamInterfacesUpdateParamInterfaceMockHandler(),
  getParamInterfacesDeleteParamInterfaceMockHandler(),
  getParamInterfacesListParamInterfaceLinksMockHandler(),
  getParamInterfacesLinkParamInterfaceMockHandler(),
  getParamInterfacesUnlinkParamInterfaceMockHandler(),
]);
const orvalMockHandlers = getTitleMock().filter((h) => !OVERRIDDEN_BY_EXTRA.has(h));

export const handlers = [...extraHandlers, ...orvalMockHandlers];
export default handlers;
