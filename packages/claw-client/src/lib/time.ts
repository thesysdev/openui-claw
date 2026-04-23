/** "5m ago" / "2h ago" / "3d ago" / "Mar 5" format. */
export function relTime(value: number | string | null | undefined): string {
  if (value == null) return "";
  const ts = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ts)) return "";

  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "now";

  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
