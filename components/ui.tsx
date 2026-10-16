import type { ComponentProps, ReactNode } from "react";

import type { Priority } from "@/lib/schemas";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55";

  const variants = {
    primary: "bg-accent text-accent-ink hover:opacity-90",
    secondary: "border border-line bg-raised text-ink hover:border-accent/60",
    ghost: "text-muted hover:bg-raised hover:text-ink",
  } as const;

  return <button className={cx(base, variants[variant], className)} {...props} />;
}

/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("rounded-2xl border border-line bg-surface p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-xl border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(CONTROL, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(CONTROL, "appearance-none", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(CONTROL, "resize-y leading-relaxed", className)} {...props} />;
}

/* ------------------------------------------------------------------ */

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "positive" | "caution" | "critical";
}) {
  const tones = {
    neutral: "border-line bg-raised text-muted",
    accent: "border-accent/40 bg-accent-soft text-accent",
    positive: "border-positive/40 bg-positive/10 text-positive",
    caution: "border-caution/40 bg-caution/10 text-caution",
    critical: "border-critical/40 bg-critical/10 text-critical",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const tone = priority === "high" ? "critical" : priority === "medium" ? "caution" : "neutral";
  return <Pill tone={tone}>{priority}</Pill>;
}

/* ------------------------------------------------------------------ */

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      {label ? <span>{label}</span> : null}
      <span className="sr-only">Working</span>
    </span>
  );
}

export function Callout({
  tone = "critical",
  children,
}: {
  tone?: "critical" | "caution" | "accent";
  children: ReactNode;
}) {
  const tones = {
    critical: "border-critical/40 bg-critical/10 text-critical",
    caution: "border-caution/40 bg-caution/10 text-caution",
    accent: "border-accent/40 bg-accent-soft text-ink",
  } as const;

  return (
    <div role="alert" className={cx("rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2.5">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
