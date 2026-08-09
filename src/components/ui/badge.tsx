import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent";

const badgeStyles: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  accent: "bg-accent/10 text-accent border-accent/20",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-medium",
        badgeStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export function TagBadge({
  type,
  ...props
}: { type: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const variant: BadgeVariant =
    type === "ROOT" || type === "AFFIX"
      ? "accent"
      : type === "MEANING"
        ? "success"
        : type === "GRAMMAR"
          ? "warning"
          : "default";
  return <Badge variant={variant} {...props} />;
}
