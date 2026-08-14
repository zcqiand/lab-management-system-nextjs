// 占位文件 —— drizzle.config.pg.ts:schema 字段要求指向一个存在的 .ts。
//
// 本仓**不手抄** PG 表定义；PG 表全部由 emit-schema.mjs 从 shared/sql/migrations/V*.sql
// replay 后用 drizzle-kit pull 写出到 generated/schema.ts。
//
// 这里只 export 一个空数组，保持 drizzle-kit pull 的 schema 解析不报错。
export const pgSchema = [];
