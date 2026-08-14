// Runtime backend-switching singleton (module-level, not Context).
// Lab family: msw / aspnetcore / springboot / nextjs 四模式运行时切换。
// Next.js 端 BACKEND_DEFAULT_BASE_URLS 的 nextjs 是同源（""），命中本仓 API routes。

export type BackendMode = "msw" | "aspnetcore" | "springboot" | "nextjs";

const DEFAULT_BASE_URLS: Readonly<Record<BackendMode, string>> = {
  msw: "",
  aspnetcore: "http://localhost:5000",
  springboot: "http://localhost:8080",
  nextjs: "",
};

let currentBackend: BackendMode = "msw";
let baseUrls: Record<BackendMode, string> = { ...DEFAULT_BASE_URLS };

export function getBackend(): BackendMode {
  return currentBackend;
}
export function setBackend(mode: BackendMode): void {
  currentBackend = mode;
}
export function getBaseUrl(): string {
  return baseUrls[currentBackend];
}
export function getBaseUrlFor(mode: BackendMode): string {
  return baseUrls[mode];
}
export function setBaseUrlFor(mode: BackendMode, url: string): void {
  baseUrls[mode] = url;
}

export function hydrateBackendConfig(persisted: {
  backend?: BackendMode;
  baseUrls?: Partial<Record<BackendMode, string>>;
}): void {
  if (persisted.backend) currentBackend = persisted.backend;
  if (persisted.baseUrls) baseUrls = { ...baseUrls, ...persisted.baseUrls };
}

export function snapshotBackendConfig(): {
  backend: BackendMode;
  baseUrls: Record<BackendMode, string>;
} {
  return { backend: currentBackend, baseUrls: { ...baseUrls } };
}

export const BACKEND_DEFAULT_BASE_URLS = DEFAULT_BASE_URLS;
