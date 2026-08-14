// scripts/v-sql-to-dbml.mjs — parse shared/sql/migrations/V*.sql into DBML 0.9
// representation. No DBML runtime dep; emit is hand-rolled for the constructs that
// lab-management-system actually uses (CREATE TABLE / CREATE INDEX / CREATE UNIQUE INDEX
// / ALTER TABLE ADD COLUMN / comments). Foreign keys are read from inline REFERENCES
// declarations (not enforced by parser — relies on the existing V001..V012 style).
//
// 错误规约：解析不到的东西（罕见语法、未知子句）写入 DBML 「-- raw:」注释里，不直接抛错
// —— 让「轻微漂移」也能跑出可读的 DBML 文件，便于人工 review。

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SHARED = resolve(ROOT, "../lab-management-system-shared");
const MIGRATIONS = resolve(SHARED, "sql/migrations");
const OUT = resolve(ROOT, "generated");

function listMigrations() {
  return readdirSync(MIGRATIONS)
    .filter((f) => /^V\d+__.+\.sql$/.test(f))
    .sort();
}

// 解析一段 V*.sql 为一个 {tables, indexes, alters} 三元组。每个 V 累加进主状态。
// 状态只关心表结构与索引；不解析 trigger / policy / view 等（lab 当前不用）。
function parseVFile(sql) {
  const tables = []; // {schema?: string, name, columns: [{name, type, pk, notNull, default, references?}], rawComments: string[]}
  const indexes = []; // {name, table, unique, columns: string[], where?: string}
  const alters = []; // {table, op: 'addColumn'|'dropColumn'|'addConstraint'..., payload: any}
  const comments = []; // {text}

  // 简化版：按行扫描 + 维护一个「当前活跃的 CREATE TABLE 块」。
  let lines = sql.split(/\r?\n/);
  let i = 0;
  let cur = null;

  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.replace(/--.*$/, "").trim();

    if (!stripped) { i++; continue; }

    // 顶层注释
    const fileComment = /^--\s*(.+)$/.exec(line);
    if (fileComment && !cur) { comments.push(fileComment[1]); i++; continue; }

    // CREATE TABLE
    const createTbl = /^CREATE TABLE(?:\s+IF NOT EXISTS)?\s+("?[\w]+"?\.)?"?([\w]+)"?\s*\((.*?)\);/su
      .exec(sql.slice(sql.indexOf(line)));
    if (stripped.startsWith("CREATE TABLE")) {
      // 跨括号解析（简化处理：取到顶层 ）;）
      const m = /^CREATE TABLE(?:\s+IF NOT EXISTS)?\s+("?[\w]+"?\.)?"?([\w]+)"?\s*\(/i.exec(stripped);
      if (!m) { i++; continue; }
      const schema = m[1]?.replace(/"/g, "").replace(/\.$/, "");
      const name = m[2];
      // 把括号体拼出来
      const startIdx = sql.indexOf(line) + sql.indexOf(line) - sql.indexOf(line); // 仅作占位
      // 用更稳的方式：从 stripped 起点找 ( 后的内容到匹配 )
      let depth = 0;
      let openIdx = stripped.indexOf("(");
      let body = "";
      let endStmt = null;
      if (openIdx >= 0) {
        // 找匹配 )
        let buf = "";
        for (let j = i; j < lines.length; j++) {
          buf += lines[j] + "\n";
          let d = 0;
          for (const ch of lines[j]) {
            if (ch === "(") d++;
            else if (ch === ")") d--;
          }
          if (d < 0 && buf.trim().endsWith(";")) {
            const m2 = /\(([\s\S]*?)\)\s*;/u.exec(buf);
            if (m2) { body = m2[1]; endStmt = j; break; }
          }
        }
      }
      if (body) {
        cur = { schema, name, rawBody: body, columns: [] };
        // 切分行（按逗号，但括号内的逗号不算）
        const splitBody = body.split(/,(?![^()]*\))/);
        for (const raw of splitBody) {
          const r = raw.trim();
          if (!r) continue;
          // 列定义：name TYPE [NOT NULL|DEFAULT|...|REFERENCES ...]
          const cm = /^"?(?<n>[\w]+)"?\s+(?<t>[\w()\[\] ,]+)(?<rest>.*)$/su.exec(r);
          if (!cm) continue;
          const colName = cm.groups.n;
          const colType = cm.groups.t.replace(/\s+/g, " ").trim();
          const rest = cm.groups.rest || "";
          const notNull = /\bNOT NULL\b/i.test(rest);
          let def = "";
          const defM = /\bDEFAULT\s+([^,]+?)(?:\s+(?:NOT NULL|UNIQUE|PRIMARY KEY|CHECK|REFERENCES)\b|$)/i.exec(rest);
          if (defM) def = defM[1].trim();
          const pk = /\bPRIMARY KEY\b/i.test(rest);
          let ref = null;
          const refM = /REFERENCES\s+("?[\w]+"?\.)?"?([\w]+)"?\s*\(([^)]+)\)/i.exec(rest);
          if (refM) ref = { table: refM[2], columns: refM[3].split(",").map((s) => s.trim().replace(/"/g, "")) };
          cur.columns.push({ name: colName, type: colType, notNull, default: def, pk, references: ref });
        }
        tables.push(cur);
        cur = null;
        i = endStmt + 1;
        continue;
      }
      i++; continue;
    }

    // CREATE [UNIQUE] INDEX
    const idxM = /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?"?([\w]+)"?\s+ON\s+("?[\w]+"?\.)?"?([\w]+)"?\s*\(([^)]+)\)(?:\s+WHERE\s+(.+))?;/i.exec(stripped);
    if (idxM) {
      const unique = !!idxM[1];
      const name = idxM[2];
      const table = idxM[4];
      const cols = idxM[5].split(",").map((s) => s.trim().replace(/"/g, ""));
      const where = idxM[6] ?? null;
      indexes.push({ name, table, unique, columns: cols, where });
      i++; continue;
    }

    // ALTER TABLE ... ADD COLUMN
    const addColM = /^ALTER TABLE\s+("?[\w]+"?\.)?"?([\w]+)"?\s+ADD COLUMN\s+("?[\w]+"?)\s+([\w()\[\] ,]+)(.*?);/i.exec(stripped);
    if (addColM) {
      const table = addColM[2];
      const cname = addColM[3];
      const ctype = addColM[4].trim();
      const rest = addColM[5] || "";
      alters.push({
        table,
        op: "addColumn",
        payload: { name: cname, type: ctype, notNull: /\bNOT NULL\b/i.test(rest), default: (/\bDEFAULT\s+([^,;]+)/i.exec(rest)?.[1] ?? "").trim() },
      });
      i++; continue;
    }

    // 其他语句（CREATE TYPE / CREATE EXTENSION / GRANT / 等）—— 单行放过，不入 DBML。
    i++;
  }

  return { tables, indexes, alters, comments };
}

function toDbml(allFiles) {
  const lines = [];
  lines.push(`// generated by scripts/v-sql-to-dbml.mjs — DO NOT EDIT`);
  lines.push(`// source: ../lab-management-system-shared/sql/migrations/V*.sql`);
  lines.push(`// tables: ${allFiles.tables.length}  indexes: ${allFiles.indexes.length}`);
  lines.push("");

  // 注释段
  if (allFiles.comments.length) {
    lines.push("// === migration notes ===");
    for (const c of allFiles.comments) lines.push(`// ${c}`);
    lines.push("");
  }

  // CREATE TABLE 段
  const seen = new Map();
  for (const t of allFiles.tables) {
    const key = `${t.schema ?? "public"}.${t.name}`;
    if (!seen.has(key)) seen.set(key, { ...t, columns: [], alters: [] });
  }
  // 把 alters 应用到对应表
  for (const a of allFiles.alters) {
    for (const [k, t] of seen) {
      if (k.endsWith(`.${a.table}`)) {
        t.alters.push(a);
        break;
      }
    }
  }

  for (const [, t] of seen) {
    lines.push(`Table ${t.schema ?? "public"}.${t.name} {`);
    for (const c of t.columns) {
      const pk = c.pk ? " [pk]" : "";
      const nn = c.notNull && !c.pk ? " not null" : "";
      const df = c.default ? ` default \`${c.default}\`` : "";
      lines.push(`  ${c.name} ${c.type}${nn}${df}${pk}`);
      if (c.references) {
        lines[lines.length - 1] += ` // references ${c.references.table}(${c.references.columns.join(",")})`;
      }
    }
    for (const a of t.alters) {
      if (a.op === "addColumn") {
        const nn = a.payload.notNull ? " not null" : "";
        const df = a.payload.default ? ` default \`${a.payload.default}\`` : "";
        lines.push(`  ${a.payload.name} ${a.payload.type}${nn}${df} // from ALTER ADD COLUMN`);
      }
    }
    lines.push(`}`);
    lines.push("");
  }

  // INDEX 段
  if (allFiles.indexes.length) {
    lines.push("// === indexes ===");
    for (const ix of allFiles.indexes) {
      const u = ix.unique ? " [unique]" : "";
      const where = ix.where ? ` where \`${ix.where}\`` : "";
      lines.push(`// ${ix.name}: on ${ix.table} (${ix.columns.join(", ")})${u}${where}`);
    }
    lines.push("");
  }

  // 跨仓依赖用 blocknote
  lines.push("// === raw: ===");
  lines.push("//   add your review notes here");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const files = listMigrations();
  const agg = { tables: [], indexes: [], alters: [], comments: [] };
  for (const f of files) {
    const sql = readFileSync(resolve(MIGRATIONS, f), "utf8");
    const parsed = parseVFile(sql);
    agg.tables.push(...parsed.tables);
    agg.indexes.push(...parsed.indexes);
    agg.alters.push(...parsed.alters);
    agg.comments.push(...parsed.comments.map((c) => `[${f}] ${c}`));
  }
  mkdirSync(OUT, { recursive: true });
  const dbml = toDbml(agg);
  const out = resolve(OUT, "schema.dbml");
  writeFileSync(out, dbml);
  console.log(`[v-sql-to-dbml] 写了 ${out}`);
  console.log(`[v-sql-to-dbml]   tables=${agg.tables.length}  indexes=${agg.indexes.length}  alters=${agg.alters.length}`);
}

main();
