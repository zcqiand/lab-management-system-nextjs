// src/lib/db-queries.ts — DB 数据访问层：row↔DTO 映射 + 各路由域查询/写入函数。
// 语义真相源 = 各 route.ts 头部注释所引的 lab-msw handler 行为。
// 映射器实现零 import 放在 db-map.ts（seed 脚本复用）；本文件 re-export，
// 域查询函数（真正 import { db, schema } from "@/db"）由后续任务追加。
export {
  TENANT,
  toCamel,
  toSnake,
  rowToDto,
  dtoToRow,
  PG_TABLES,
} from "./db-map";
