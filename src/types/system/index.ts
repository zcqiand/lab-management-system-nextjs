/**
 * M01 系统管理领域类型 barrel
 *
 * 状态：Phase 4 暂保留本地 per-entity 文件作为契约镜像。
 */

export type { Permission, Role } from './permission';
export type {
  User,
  UserRecord,
  UserQuery,
  UserCreateInput,
  UserUpdateInput,
  ChangePasswordInput,
} from './user';
export type {
  RoleRecord,
  RoleQuery,
  RoleCreateInput,
  RoleUpdateInput,
} from './role';
export type { OrgInfo } from './org-info';