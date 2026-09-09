"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { IncomeTrendPoint } from "@/lib/dashboardMetrics";

export function IncomeTrendChart({ data }: { data: IncomeTrendPoint[] }) {
  const hasData = data.some((point) => point.totalPaid > 0);
  if (!hasData) {
    return <p className="text-gray-500">No income recorded in this range yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="totalPaid" stroke="#b45309" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
