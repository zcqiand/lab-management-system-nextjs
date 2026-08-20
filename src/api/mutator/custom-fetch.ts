// orval mutator — 兼容 axios 1.7+ strict-mode 类型。
//
// orval 'axios-functions' 默认生成 `Promise<TData>` 函数签名，axios.get 返回
// Promise<AxiosResponseResult<...>>（5-arg 条件类型），TS strict mode 下不兼容。
// customFetch 用 any 包装（仅影响类型推断；运行时透传给 axios）。
//
// 第二参 `options` 接 axios options（baseURL / headers / signal 等），与 orval
// 'react-query' client 的 2 参风格对齐 — 调用方 `{ baseURL: baseUrl }` 走配置。

import type { AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";

export const customFetch = <TData = AxiosResponse>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<TData> => {
  return axios({ ...config, ...options }) as unknown as Promise<TData>;
};