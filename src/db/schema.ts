// 占位 —— PG 镜像专用。
//
// 本仓**不手抄** V*.sql 对应的 PG 表定义。emit-schema.mjs 用 drizzle-kit pull
// 把 PG catalog introspect 到 generated/schema.ts，那才是「PG 视图」。
//
// drizzle-kit pull 要求 schema 字段指向一个真实存在的 .ts 文件。空 array 即可。
export const pgSchema = [];
