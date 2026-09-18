"use client";
import React from "react";
import { cn } from "@/lib/utils";

// Cryptgen's chrome button, recoloured through theme tokens.
export const Button = ({
  href,
  as: Tag = "a",
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "brand";
} & (React.ComponentPropsWithoutRef<"a"> | React.ComponentPropsWithoutRef<"button">)) => {
  const baseStyles = cn(
    "px-4 py-2 rounded-md text-sm font-semibold relative",
    "cursor-pointer hover:-translate-y-0.5 transition duration-200",
    "inline-flex items-center justify-center border-[0.6px] border-solid",
  );

  const variantStyles = {
    primary: cn(
      "border-line text-background bg-foreground",
      "shadow-[inset_0px_6px_8px_0px_var(--inset-hi),inset_0px_-6px_8px_0px_var(--inset-hi)]",
    ),
    secondary: cn(
      "text-foreground bg-surface border-line",
      "[background:linear-gradient(180deg,var(--card-top),var(--card-bottom))]",
      "shadow-[inset_0px_1px_0px_0px_var(--inset-hi),0_8px_24px_var(--shadow)]",
    ),
    brand: cn("text-white bg-brand border-transparent", "shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]"),
  };

  return (
    <Tag href={href || undefined} className={cn(baseStyles, variantStyles[variant], className)} {...props}>
      {children}
    </Tag>
  );
};
