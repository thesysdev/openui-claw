"use client";

/** Time-of-day greeting used as the homepage hero. */
function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export interface GreetingProps {
  /** Display name (e.g. first initial). Omitted from the string if not provided. */
  name?: string;
  subtitle?: string;
}

export function Greeting({
  name,
  subtitle = "What would you like to work on today?",
}: GreetingProps) {
  const g = timeGreeting();
  return (
    <div className="mb-l">
      <h1 className="font-heading text-2xl font-bold text-text-neutral-primary leading-heading">
        {g}
        {name ? `, ${name}` : ""}
      </h1>
      <p className="mt-xs font-body text-md text-text-neutral-tertiary">{subtitle}</p>
    </div>
  );
}
