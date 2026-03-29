export function detectFormat(text: string): "openui" | "markdown" {
  const firstLine = text.split("\n").find((l) => l.trim() !== "");
  if (firstLine && /^root\s*=\s*\w+\(/.test(firstLine.trim())) {
    return "openui";
  }
  return "markdown";
}
