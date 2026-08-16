// re-export drizzle-kit pull 产物（generated/schema.ts，gitignored）。
// 与 src/api/endpoints/ 同款消费模式：新 clone 后先跑
//   npx drizzle-kit pull --config=drizzle.config.pg.ts
// （drizzle.config.pg.ts 的 schema 字段历史指向本文件，pull 时本文件是空 array 即可——
//  所以保留下面的占位导出，pull 不会覆盖本文件，只写 generated/。）
export const pgSchema = [];
export * from "../../generated/schema";
