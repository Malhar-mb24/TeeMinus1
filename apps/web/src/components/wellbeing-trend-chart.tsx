"use client";

import { formatDurationCompact, type WellbeingDailyTrendDto } from "@ember/shared";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WellbeingTrendChartProps {
  trend: WellbeingDailyTrendDto[];
  todayDate: string;
  height?: number;
}

export function WellbeingTrendChart({
  trend,
  todayDate,
  height = 220,
}: WellbeingTrendChartProps) {
  const chartData = trend.map((day) => ({
    ...day,
    totalMinutes: Math.round((day.totalSeconds / 60) * 10) / 10,
  }));

  return (
    <div className="min-w-0 w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 6, left: -4, bottom: 0 }}>
          <XAxis
            dataKey="dayLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9B8F80", fontSize: 12 }}
          />
          <YAxis
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7F7568", fontSize: 11 }}
            tickFormatter={(val: number) =>
              val >= 60 ? `${Math.round((val / 60) * 10) / 10}h` : `${Math.round(val)}m`
            }
          />
          <Tooltip
            cursor={{ fill: "rgba(250,244,235,0.03)" }}
            contentStyle={{
              backgroundColor: "#14110F",
              borderColor: "#2B2520",
              borderRadius: "12px",
              color: "#FAF4EB",
              fontSize: "12px",
            }}
            formatter={(_value, _name, item) => {
              const row = item?.payload as WellbeingDailyTrendDto | undefined;
              if (!row) return ["0s", "Screen Time"];
              return [
                `${formatDurationCompact(row.totalSeconds)} total (${formatDurationCompact(
                  row.websiteSeconds
                )} web · ${formatDurationCompact(row.desktopSeconds)} apps · ${formatDurationCompact(
                  row.focusSeconds
                )} focus)`,
                row.localDate,
              ];
            }}
          />
          <Bar dataKey="totalMinutes" radius={[10, 10, 4, 4]} maxBarSize={42}>
            {chartData.map((entry) => (
              <Cell
                key={entry.localDate}
                fill={
                  entry.localDate === todayDate
                    ? "#F97316"
                    : entry.totalSeconds > 0
                      ? "#8F7760"
                      : "#221D19"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
