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
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={buckets}
          margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
        >
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8E95A2", fontSize: 12 }}
          />
          <YAxis
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6F7685", fontSize: 11 }}
            tickFormatter={(val: number) => `${val}m`}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{
              backgroundColor: "#131519",
              borderColor: "#252932",
              borderRadius: "12px",
              color: "#F4F5F7",
              fontSize: "12px",
            }}
            formatter={(value: unknown) => [`${String(value ?? 0)} min`, "Focus"]}
          />
          <Bar dataKey="focusMinutes" radius={[8, 8, 4, 4]} maxBarSize={44}>
            {buckets.map((entry) => (
              <Cell
                key={entry.localDate}
                fill={
                  entry.localDate === todayDate
                    ? "#F97316"
                    : entry.focusMinutes > 0
                      ? "#BAE6FD"
                      : "#1F242D"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
