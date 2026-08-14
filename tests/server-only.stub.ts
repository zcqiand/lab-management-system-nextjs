/**
 * Empty stub for `server-only` so vitest (which runs in plain Node ESM) doesn't trip
 * on Next's RSC bundler trick where the package throws when imported from a client module.
 *
 * In tests, importing `db` or any other module marked `import "server-only"` is fine —
 * we're on the server side of a server-only context by definition.
 *
 * 这个文件只有被 vitest 的 resolve.alias 重定向过来时才会被加载。在生产 bundle 里它不存在。
 */
export {};
