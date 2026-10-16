import { statusLabel, type CapabilityStatus } from "@/config/capabilities";
import { Badge } from "./Badge";

const tone = {
  available: "positive",
  demo: "info",
  "in-development": "warning",
  planned: "neutral",
} as const;

export function StatusBadge({ status }: { status: CapabilityStatus }) {
  return <Badge tone={tone[status]}>{statusLabel[status]}</Badge>;
}
