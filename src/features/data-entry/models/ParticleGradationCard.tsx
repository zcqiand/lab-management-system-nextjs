import { useEffect, useState } from "react";
import type { ParamModelProps } from "./types";

/**
 * 颗粒级配录入卡（componentPath = particle-gradation）
 *
 * 砂 / 碎（卵）石 检测报告的颗粒级配表录入（GB/T 14684 / GB/T 14685）。
 *
 * 每样品 3 子行：筛余量(g) / 分计筛余(%) / 累计筛余(%)；
 * 右侧 3 列：分筛前总量(g) / 分筛后总量(g) / 细度模数。
 * 末行「平均」= 各样品分计筛余量(%) 的均值。
 *
 * 录入：分筛前/后总量(g) + 各筛孔分计筛余量(%)（用户也可只输 筛余量(g)，
 *       组件按 totalBefore 自动换算 分计筛余；二者只存 1 份：以分计筛余为准）。
 * 自动算：累计筛余 = 前 i 项分计筛余累加；
 *         细度模数 M_x = (∑ 累计筛余前 6 孔) / (100 − 筛底累计筛余)；
 *         平均 = 各样品每孔分计筛余的均值。
 */

type Props = Pick<
  ParamModelProps,
  "parameter" | "record" | "sampleId" | "config" | "readOnly" | "onChange"
>;

const SIEVE_COLS_SAND = [
  "4.75mm",
  "2.36mm",
  "1.18mm",
  "0.60mm",
  "0.30mm",
  "0.15mm",
  "筛底",
];
const SIEVE_COLS_GRAVEL = [
  "90mm",
  "75mm",
  "63mm",
  "53mm",
  "37.5mm",
  "31.5mm",
  "26.5mm",
  "19mm",
  "16mm",
  "9.5mm",
  "4.75mm",
  "2.36mm",
];

interface Row {
  retainedPct: number[]; // 长度 = SIEVE_COLS.length
  totalBefore: number;
  totalAfter: number;
}

interface ParsedResult {
  rows: Row[];
  sieveCount: number;
}

function parseResult(raw: string | undefined, fallbackSieveCount: number): ParsedResult {
  if (!raw) return { rows: [], sieveCount: fallbackSieveCount };
  try {
    const obj = JSON.parse(raw) as { rows?: Row[]; sieveCount?: number };
    if (Array.isArray(obj.rows)) {
      // 标准化每行 retainedPct 长度
      const rows = obj.rows.map((r) => {
        const arr = Array.isArray(r.retainedPct) ? [...r.retainedPct] : [];
        while (arr.length < fallbackSieveCount) arr.push(0);
        return {
          retainedPct: arr.slice(0, fallbackSieveCount),
          totalBefore: r.totalBefore ?? 0,
          totalAfter: r.totalAfter ?? 0,
        };
      });
      return { rows, sieveCount: obj.sieveCount ?? fallbackSieveCount };
    }
  } catch {
    /* fall through */
  }
  return { rows: [], sieveCount: fallbackSieveCount };
}

function computeCumulative(retainedPct: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const v of retainedPct) {
    acc += Number(v) || 0;
    out.push(Math.round(acc * 100) / 100);
  }
  return out;
}

function computeFinenessModulus(cumulativePct: number[], sieveCount: number): number {
  // GB/T 14684 砂：前 6 个累计筛余之和 / (100 − 筛底累计筛余)
  const topSix = cumulativePct.slice(0, Math.min(6, sieveCount - 1));
  const sum = topSix.reduce((a, b) => a + b, 0);
  const bottom = cumulativePct[sieveCount - 1] ?? 0;
  if (bottom >= 100) return 0;
  return Math.round((sum / (100 - bottom)) * 100) / 100;
}

function averageByCol(rows: Row[]): number[] {
  if (rows.length === 0) return [];
  const len = rows[0]!.retainedPct.length;
  const out: number[] = [];
  for (let c = 0; c < len; c++) {
    let s = 0;
    let n = 0;
    for (const r of rows) {
      const v = Number(r.retainedPct[c]);
      if (Number.isFinite(v) && v > 0) {
        s += v;
        n++;
      }
    }
    out.push(n > 0 ? Math.round((s / n) * 10) / 10 : 0);
  }
  return out;
}

export function ParticleGradationCard({
  parameter: param,
  record,
  sampleId,
  config,
  onChange,
  readOnly = false,
}: Props) {
  const cfg = (config ?? {}) as {
    sieveCount?: number;
    sampleRows?: number;
    gravel?: boolean;
  };
  const sieveCols = cfg.gravel ? SIEVE_COLS_GRAVEL : SIEVE_COLS_SAND;
  const sieveCount = sieveCols.length;
  const sampleRows = cfg.sampleRows ?? 2;

  const [rows, setRows] = useState<Row[]>(() => {
    const parsed = parseResult(record?.result, sieveCount);
    if (parsed.rows.length > 0) return parsed.rows;
    return Array.from({ length: sampleRows }, () => ({
      retainedPct: Array(sieveCount).fill(0),
      totalBefore: 0,
      totalAfter: 0,
    }));
  });
  useEffect(() => {
    const parsed = parseResult(record?.result, sieveCount);
    if (parsed.rows.length > 0) {
      setRows(parsed.rows);
    } else {
      setRows(
        Array.from({ length: sampleRows }, () => ({
          retainedPct: Array(sieveCount).fill(0),
          totalBefore: 0,
          totalAfter: 0,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 切换样品/落库后重置，避免每次输入被覆盖
  }, [sampleId, record?.result, sieveCount, sampleRows]);

  const updatePct = (ri: number, ci: number, v: number) => {
    if (readOnly) return;
    setRows((prev) => {
      const next = prev.map((r, i) => {
        if (i !== ri) return r;
        const retainedPct = [...r.retainedPct];
        retainedPct[ci] = Number.isFinite(v) ? v : 0;
        return { ...r, retainedPct };
      });
      return next;
    });
  };
  const updateTotal = (ri: number, field: "totalBefore" | "totalAfter", v: number) => {
    if (readOnly) return;
    setRows((prev) => prev.map((r, i) => (i === ri ? { ...r, [field]: v } : r)));
  };

  // 落库形状必须包含派生列：报告模板通过
  //   record:IP-0577:rows[i].cumulativePct[j] / rows[i].finenessModulus / average[j]
  // 直接取数（见 data/templates/103_*.inject.json）。累计筛余与细度模数只在渲染时算、
  // 不落库的话，砂/碎（卵）石四份报告的级配表会整片渲染成「—」。
  // 注意：emit 直接挂在 onClick/onBlur 上，形参会被 React 传入事件对象——保持零参。
  const emit = () => {
    const persistedRows = rows.map((r) => {
      const cumulativePct = computeCumulative(r.retainedPct);
      return {
        ...r,
        cumulativePct,
        finenessModulus: computeFinenessModulus(cumulativePct, sieveCount),
      };
    });
    const result = JSON.stringify({
      rows: persistedRows,
      sieveCount,
      average: averageByCol(rows),
    });
    onChange({ result });
  };

  // 计算每行的累计筛余 + 细度模数 + 全局平均
  const rowComputed = rows.map((r) => {
    const cum = computeCumulative(r.retainedPct);
    const fm = computeFinenessModulus(cum, sieveCount);
    return { cum, fm, delta: r.totalAfter > 0 ? r.totalBefore - r.totalAfter : 0 };
  });
  const avg = averageByCol(rows);

  return (
    // @entry M03.F03.I03 颗粒级配录入卡（GB/T 14684 砂 / GB/T 14685 碎卵石）。
    // 落库完全由外层 EntryModal 的「保存」按钮驱动（每 input onBlur 调 emit → onChange({result})），
    // 本卡不自带保存按钮。
    <div className="border rounded p-3 space-y-3" data-fn="M03.F03.I03">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-red-600">
          颗 粒 级 配{param?.unit ? `（${param.unit}）` : ""}
        </span>
      </div>

      <table className="w-full text-xs border-collapse border border-gray-300">
        <thead className="bg-blue-50 text-gray-700">
          <tr>
            <th className="border border-gray-300 px-2 py-1 text-left w-6">序号</th>
            <th className="border border-gray-300 px-2 py-1 text-left w-20">项目</th>
            {sieveCols.map((s) => (
              <th
                key={s}
                className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap"
              >
                {s}
              </th>
            ))}
            <th className="border border-gray-300 px-2 py-1 text-left w-32">
              分筛前总量(g):
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const cum = rowComputed[ri]!.cum;
            const fm = rowComputed[ri]!.fm;
            const delta = rowComputed[ri]!.delta;
            return (
              <FragmentRow
                key={ri}
                ri={ri}
                row={row}
                cum={cum}
                fm={fm}
                delta={delta}
                sieveCols={sieveCols}
                readOnly={readOnly}
                onPctChange={updatePct}
                onTotalChange={updateTotal}
                onBlur={emit}
              />
            );
          })}
          <tr className="bg-gray-50 font-medium">
            <td className="border border-gray-300 px-2 py-1"></td>
            <td className="border border-gray-300 px-2 py-1">平均值(%):</td>
            {avg.map((v, ci) => (
              <td key={ci} className="border border-gray-300 px-2 py-1 text-center">
                {v === 0 ? "—" : v}
              </td>
            ))}
            <td className="border border-gray-300 px-2 py-1"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface FragmentRowProps {
  ri: number;
  row: Row;
  cum: number[];
  fm: number;
  delta: number;
  sieveCols: string[];
  readOnly: boolean;
  onPctChange: (ri: number, ci: number, v: number) => void;
  onTotalChange: (ri: number, field: "totalBefore" | "totalAfter", v: number) => void;
  onBlur: () => void;
}

function FragmentRow({
  ri,
  row,
  cum,
  fm,
  delta,
  sieveCols,
  readOnly,
  onPctChange,
  onTotalChange,
  onBlur,
}: FragmentRowProps) {
  return (
    <>
      <tr>
        <td
          className="border border-gray-300 px-2 py-1 text-center font-medium"
          rowSpan={3}
        >
          {ri + 1}
        </td>
        <td className="border border-gray-300 px-2 py-1">筛余量(g):</td>
        {row.retainedPct.map((pct, ci) => {
          const total = row.totalBefore > 0 ? row.totalBefore : 1;
          const grams = (pct * total) / 100;
          return (
            <td
              key={ci}
              className="border border-gray-300 px-1 py-1 text-center text-gray-500"
            >
              {pct === 0 ? "" : Math.round(grams)}
            </td>
          );
        })}
        <td className="border border-gray-300 px-1 py-1 text-center">
          <input
            type="number"
            step="1"
            aria-label={`第 ${ri + 1} 行 分筛前总量`}
            value={row.totalBefore === 0 ? "" : row.totalBefore}
            onChange={(e) =>
              onTotalChange(
                ri,
                "totalBefore",
                e.target.value === "" ? 0 : Number(e.target.value),
              )
            }
            onBlur={onBlur}
            readOnly={readOnly}
            className="w-20 border rounded px-1 py-0.5 text-xs text-center read-only:bg-gray-50 read-only:text-gray-500"
          />
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 px-2 py-1">分计筛余量(%):</td>
        {row.retainedPct.map((pct, ci) => (
          <td key={ci} className="border border-gray-300 px-1 py-1 text-center">
            <input
              type="number"
              step="0.1"
              aria-label={`第 ${ri + 1} 行 ${sieveCols[ci]} 分计筛余`}
              value={pct === 0 ? "" : pct}
              onChange={(e) =>
                onPctChange(ri, ci, e.target.value === "" ? 0 : Number(e.target.value))
              }
              onBlur={onBlur}
              readOnly={readOnly}
              className="w-16 border rounded px-1 py-0.5 text-xs text-center read-only:bg-gray-50 read-only:text-gray-500"
            />
          </td>
        ))}
        <td className="border border-gray-300 px-1 py-1 text-center">
          分筛后总量(g):&nbsp;
          <input
            type="number"
            step="1"
            aria-label={`第 ${ri + 1} 行 分筛后总量`}
            value={row.totalAfter === 0 ? "" : row.totalAfter}
            onChange={(e) =>
              onTotalChange(
                ri,
                "totalAfter",
                e.target.value === "" ? 0 : Number(e.target.value),
              )
            }
            onBlur={onBlur}
            readOnly={readOnly}
            className="w-20 border rounded px-1 py-0.5 text-xs text-center read-only:bg-gray-50 read-only:text-gray-500"
          />
          {delta !== 0 && (
            <span className="ml-1 text-[10px] text-orange-500">Δ{delta}</span>
          )}
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 px-2 py-1">累计筛余量(%):</td>
        {cum.map((c, ci) => (
          <td
            key={ci}
            className="border border-gray-300 px-1 py-1 text-center text-gray-700"
          >
            {c === 0 ? "" : c}
          </td>
        ))}
        <td className="border border-gray-300 px-1 py-1 text-center">
          细&nbsp;度&nbsp;模&nbsp;数:&nbsp;
          <span className="font-mono">{fm === 0 ? "—" : fm}</span>
        </td>
      </tr>
    </>
  );
}

export default ParticleGradationCard;
