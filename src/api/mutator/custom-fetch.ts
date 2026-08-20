// orval mutator — 兼容 axios 1.7+ strict-mode 类型 + 透传 response body。
//
// orval 'axios-functions' 默认生成 `Promise<TData>` 函数签名，axios.get 返回
// Promise<AxiosResponse<...>>（5-arg 条件类型），TS strict mode 下不兼容。
// customFetch 用 `as unknown as Promise<TData>` 桥接类型 + `.then(r => r.data)`
// 解包响应体（去掉 AxiosResponse 外壳），符合 orval mutator 契约——
// 调用方拿到的是 TData（body）而不是 AxiosResponse<TData>。
//
// 2026-08-20 修复：原实现漏写 `.then(r => r.data)`，整 AxiosResponse 当 body
// 透传，导致 `LoginPage:127` 看到 `authorizeUrl=undefined`、
// `login-form:24` 看到 `token=undefined`（都被 `(res as { foo })` 类型断言遮蔽）。
//
// 第二参 `options` 接 axios options（baseURL / headers / signal 等），与 orval
// 'react-query' client 的 2 参风格对齐 — 调用方 `{ baseURL: baseUrl }` 走配置。

import type { AxiosRequestConfig } from "axios";
import axios from "axios";

export const customFetch = <TData = unknown>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<TData> => {
  return axios({ ...config, ...options }).then((r) => r.data) as unknown as Promise<TData>;
};