"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { IncomeTrendPoint } from "@/lib/dashboardMetrics";

function EmptyTrendState({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-zinc-300">
        <path d="M4 17L9 11L13 14L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-zinc-500">{message}</p>
    </div>
  );
}

export function IncomeTrendChart({ data }: { data: IncomeTrendPoint[] }) {
  const hasData = data.some((point) => point.totalPaid > 0);
  if (!hasData) {
    return <EmptyTrendState message="No income recorded in this range yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="totalPaid" stroke="#9C4526" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
