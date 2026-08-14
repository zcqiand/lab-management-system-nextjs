import type { Permission } from './permission';
import type { PageQuery } from '../common';

/** 角色管理（M01.F02） */
export interface RoleRecord {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleQuery extends PageQuery {
  name?: string;
}

export interface RoleCreateInput {
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface RoleUpdateInput {
  name?: string;
  description?: string;
  permissions?: Permission[];
}