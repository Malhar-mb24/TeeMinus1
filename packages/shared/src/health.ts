import { z } from "zod";

export const healthStatusSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["connected", "unconfigured", "error"]),
  auth: z.enum(["configured", "unconfigured"]),
  latencyMs: z.number().nullable(),
  timestamp: z.string(),
  version: z.string(),
});

export type HealthCheckResponse = z.infer<typeof healthStatusSchema>;

export function formatMinutesLabel(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}
