"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Button({
  variant = "default",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium",
        "transition-[background,border-color,opacity] duration-150",
        "disabled:pointer-events-none disabled:opacity-45",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
        size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]",
        variant === "default" &&
          "border-[var(--color-line-strong)] bg-[var(--color-raised)] text-[var(--color-hi)] hover:bg-[var(--color-hover)]",
        variant === "primary" &&
          "border-transparent bg-[var(--color-hi)] text-[var(--color-canvas)] hover:opacity-90",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--color-mid)] hover:bg-[var(--color-raised)] hover:text-[var(--color-hi)]",
        variant === "danger" &&
          "border-transparent bg-transparent text-[var(--color-lo)] hover:bg-[var(--color-raised)] hover:text-[#ff7676]",
        className,
      )}
    />
  );
}

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)]",
        className,
      )}
    />
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "hot" | "warm" | "cool" | "accent";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "text-[var(--color-mid)] border-[var(--color-line-strong)]",
    hot: "text-[var(--color-hot)] border-[color-mix(in_oklab,var(--color-hot)_35%,transparent)]",
    warm: "text-[var(--color-warm)] border-[color-mix(in_oklab,var(--color-warm)_35%,transparent)]",
    cool: "text-[var(--color-cool)] border-[color-mix(in_oklab,var(--color-cool)_35%,transparent)]",
    accent:
      "text-[var(--color-accent)] border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-raised)] px-3 text-[13px]",
        "text-[var(--color-hi)] placeholder:text-[var(--color-lo)]",
        "focus:border-[var(--color-accent)] focus:outline-none",
        className,
      )}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-raised)] px-3 py-2 text-[13px] leading-relaxed",
        "text-[var(--color-hi)] placeholder:text-[var(--color-lo)]",
        "focus:border-[var(--color-accent)] focus:outline-none",
        className,
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-medium tracking-wide text-[var(--color-lo)] uppercase">
      {children}
    </span>
  );
}

export function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] text-[var(--color-hi)]"
          : "border-[var(--color-line-strong)] bg-[var(--color-raised)] text-[var(--color-mid)] hover:text-[var(--color-hi)]",
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-line-strong)] px-6 py-16 text-center">
      <p className="text-[14px] font-medium text-[var(--color-hi)]">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--color-mid)]">
        {body}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
