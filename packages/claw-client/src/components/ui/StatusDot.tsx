interface StatusDotProps {
  size?: number;
  color?: string;
}

export function StatusDot({ size = 6, color = "var(--color-destructive)" }: StatusDotProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r-full)",
        backgroundColor: color,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

export default StatusDot;
