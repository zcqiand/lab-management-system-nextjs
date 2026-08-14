import type { Role, Permission } from './permission';
import type { PageQuery } from '../common';

/** 用户（M01.F03） */
export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  /** 用户最终权限集合（角色权限 + 个人授权的并集） */
  permissions: Permission[];
}

/** 用户管理（M01.F03） */
export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roleId: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface UserQuery extends PageQuery {
  role?: string;
  status?: 'active' | 'disabled';
}

export interface UserCreateInput {
  username: string;
  displayName: string;
  email: string;
  roleId: string;
  status?: 'active' | 'disabled';
}

export interface UserUpdateInput {
  displayName?: string;
  email?: string;
  roleId?: string;
  status?: 'active' | 'disabled';
}

/** 密码修改（M01.F05） */
export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}