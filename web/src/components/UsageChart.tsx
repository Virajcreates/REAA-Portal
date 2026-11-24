import { useState } from "react";
import type { UsageSeriesPoint } from "../lib/api";

interface UsageChartProps {
  series: UsageSeriesPoint[];
  title: string;
  subtitle?: string;
}

export function UsageChart({ series, title, subtitle }: UsageChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(10, ...series.map((s) => s.requests));
  const total = series.reduce((acc, s) => acc + s.requests, 0);
  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : series[series.length - 1];

  return (
    <section
      className="rounded-[8px] border p-6"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {activePoint && (
          <div className="flex items-center gap-4 text-[13px]">
            <span className="font-mono-num" style={{ color: "var(--text-secondary)" }}>
              {activePoint.date}
            </span>
            <span className="font-mono-num font-semibold" style={{ color: "var(--text-primary)" }}>
              {activePoint.requests.toLocaleString()} req
            </span>
            {activePoint.errors > 0 && (
              <span className="font-mono-num font-medium" style={{ color: "var(--danger)" }}>
                {activePoint.errors} err
              </span>
            )}
          </div>
        )}
      </div>

      {total === 0 ? (
        <div
          className="flex h-36 items-center justify-center rounded-[6px] border border-dashed text-[14px]"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
        >
          No gateway requests logged in the last 14 days.
        </div>
      ) : (
        <div className="w-full">
          <div className="flex h-40 items-end gap-1.5 sm:gap-2">
            {series.map((pt, idx) => {
              const pct = Math.max(pt.requests > 0 ? 6 : 2, Math.round((pt.requests / maxVal) * 100));
              const isSelected = hoveredIdx === idx;
              return (
                <button
                  key={pt.date}
                  type="button"
                  aria-label={`${pt.date}: ${pt.requests} requests, ${pt.errors} errors`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(idx)}
                  onBlur={() => setHoveredIdx(null)}
                  className="group flex h-full flex-1 flex-col items-center justify-end rounded-[4px] pt-2"
                >
                  <div
                    className="w-full rounded-t-[4px]"
                    style={{
                      height: `${pct}%`,
                      backgroundColor:
                        pt.requests === 0
                          ? "var(--bg-subtle)"
                          : isSelected
                            ? "var(--accent-hover)"
                            : "var(--accent)",
                      opacity: pt.requests === 0 ? 1 : isSelected ? 1 : 0.86,
                    }}
                  />
                </button>
              );
            })}
          </div>
          <div
            className="mt-2.5 flex items-center justify-between border-t pt-2 font-mono-num text-[12px]"
            style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
          >
            <span>{series[0]?.date}</span>
            <span>{series[Math.floor(series.length / 2)]?.date}</span>
            <span>{series[series.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </section>
  );
}
