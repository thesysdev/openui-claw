const BADGE_STYLE = {
  minWidth: 16,
  height: 16,
  borderRadius: "var(--r-full)",
  backgroundColor: "var(--color-destructive)",
  color: "var(--color-text-white)",
  fontFamily: "var(--font-label)",
  fontSize: "var(--fs-2xs)",
  fontWeight: "var(--fw-heavy)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 4px",
  lineHeight: 1,
  flexShrink: 0,
};

interface UnreadBadgeProps {
  count: number;
}

export function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count <= 0) return null;
  return <span style={BADGE_STYLE}>{count > 99 ? "99+" : count}</span>;
}

export default UnreadBadge;
