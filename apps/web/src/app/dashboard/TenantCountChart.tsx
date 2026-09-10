"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TenantCountPoint } from "@/lib/dashboardMetrics";

export function TenantCountChart({ data }: { data: TenantCountPoint[] }) {
  const hasData = data.some((point) => point.activeTenantCount > 0);
  if (!hasData) {
    return <p className="text-zinc-500">No active tenants in this range yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="activeTenantCount" stroke="#0f766e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
