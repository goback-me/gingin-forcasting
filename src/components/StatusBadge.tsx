const LABELS: Record<string, string> = {
  ok: "On track",
  declining: "Declining",
  high_growth: "High growth",
  low_data: "Low data",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>;
}
