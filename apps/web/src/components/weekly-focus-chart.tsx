"use client";

import type { DailyBucketDto } from "@ember/shared";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WeeklyFocusChartProps {
  buckets: DailyBucketDto[];
  todayDate: string;
  height?: number;
}

export function WeeklyFocusChart({
  buckets,
  todayDate,
  height = 210,
}: WeeklyFocusChartProps) {
  return (
    <div className="min-w-0 w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={buckets}
          margin={{ top: 8, right: 4, left: -4, bottom: 0 }}
        >
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9B8F80", fontSize: 12 }}
          />
          <YAxis
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7F7568", fontSize: 11 }}
            tickFormatter={(val: number) => `${val}m`}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,243,231,0.04)" }}
            contentStyle={{
              backgroundColor: "#171311",
              borderColor: "#3A271E",
              borderRadius: "12px",
              color: "#FFF3E7",
              fontSize: "12px",
            }}
            formatter={(value: unknown) => [`${String(value ?? 0)} min`, "Focus"]}
          />
          <Bar dataKey="focusMinutes" radius={[8, 8, 4, 4]} maxBarSize={42}>
            {buckets.map((entry) => (
              <Cell
                key={entry.localDate}
                fill={
                  entry.localDate === todayDate
                    ? "#F36B2B"
                    : entry.focusMinutes > 0
                      ? "#A87C58"
                      : "#2A1B15"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
