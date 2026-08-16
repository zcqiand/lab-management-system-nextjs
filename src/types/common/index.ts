/**
 * 通用基础类型 barrel
 *
 * 状态：Phase 4 暂保留本地 per-entity 文件作为契约镜像（与 inspection/ 一致策略）。
 */

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageQuery {
  page: number;
  pageSize: number;
  keyword?: string;
}

export interface DateRangeFilter {
  dateFrom?: string;
  dateTo?: string;
}

export type { ExtFieldDef } from './ext-field-def';
export type { ParamInterfaceRow, ParamInterfaceLink } from './inspection-param-interface';