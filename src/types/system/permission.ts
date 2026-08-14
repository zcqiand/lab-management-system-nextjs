/** 权限码：资源:操作（如 project:read、user:delete） */
export type Permission = string;

/** 角色（M01.F02） */
export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}