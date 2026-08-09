import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary:
    "bg-primary text-primary-fg hover:opacity-90 shadow-sm disabled:opacity-50",
  secondary:
    "bg-surface-2 text-text hover:bg-border disabled:opacity-50 border border-border",
  ghost: "text-muted hover:text-text hover:bg-surface-2 disabled:opacity-50",
  danger:
    "bg-danger text-white hover:opacity-90 disabled:opacity-50 shadow-sm",
};

type ButtonVariant = keyof typeof buttonVariants;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed",
        buttonVariants[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
