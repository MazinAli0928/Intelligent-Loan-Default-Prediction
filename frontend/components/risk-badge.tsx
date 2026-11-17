import type { RiskTier } from "@/lib/types";

export function RiskBadge({ value }: { value: RiskTier | string }) {
  return <span className={`badge ${value}`}>{value.replace("_", " ")}</span>;
}
