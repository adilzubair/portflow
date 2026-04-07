"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { type ComputedHolding, PIE_COLORS } from "@/lib/constants";
import { formatMoney, getAllocation } from "@/lib/utils";

interface Props {
  holdings: ComputedHolding[];
  totalValue: number;
}

export default function AllocationCharts({ holdings, totalValue }: Props) {
  const byPlatform = getAllocation(holdings, "platform", totalValue);
  const byAssetClass = getAllocation(holdings, "assetClass", totalValue);
  const byGeography = getAllocation(holdings, "geography", totalValue);

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <PieCard title="By platform" items={byPlatform} />
      <PieCard title="By asset class" items={byAssetClass} />
      <PieCard title="By geography" items={byGeography} />
    </section>
  );
}

function PieCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; weight: number }[];
}) {
  const hasData = items.length > 0 && items.some((item) => item.value > 0);

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <div className="rounded-full border border-black/8 bg-[#fff6f4] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
          {items.length || 0} slices
        </div>
      </div>

      {hasData ? (
        <>
          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={items} dataKey="value" nameKey="label" innerRadius={56} outerRadius={82} paddingAngle={2} stroke="none">
                  {items.map((item, index) => (
                    <Cell key={item.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid rgba(23,23,23,0.08)",
                    borderRadius: "1rem",
                    color: "#171717",
                    fontSize: "12px",
                    boxShadow: "0 18px 36px rgba(150,80,66,0.12)",
                  }}
                  formatter={(value) => formatMoney(Number(value), "AED")}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 space-y-2">
            {items.map((item, index) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-black/8 bg-[#fffaf8] px-3.5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text-primary">{item.label}</div>
                    <div className="mt-0.5 text-xs text-text-muted">{formatMoney(item.value, "AED")}</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-text-secondary">{item.weight.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[1.35rem] border border-dashed border-black/10 bg-[#fffaf8] px-5 py-10 text-sm text-text-muted">
          No data
        </div>
      )}
    </div>
  );
}
