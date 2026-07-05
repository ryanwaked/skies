/* Copyright 2026 Marimo. All rights reserved. */

import { cva, type VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import * as React from "react";
import { parseShortcut } from "@/core/hotkeys/shortcuts";
import { useEventListener } from "@/hooks/useEventListener";
import { cn } from "@/utils/cn";
import { Events } from "@/utils/events";
import { Logger } from "@/utils/Logger";
import { Spinner } from "../icons/spinner";
import { focusRing } from "./styles";

const activeCommon = "active:shadow-none";

const buttonVariants = cva(
  cn(
    "disabled:opacity-50 disabled:pointer-events-none",
    "inline-flex items-center justify-center rounded-md text-sm font-medium",
    focusRing,
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs border border-primary",
          activeCommon,
        ),
        destructive: cn(
          "border shadow-xs",
          "bg-destructive hover:bg-destructive/90",
          "text-destructive-foreground",
          "border-destructive",
          activeCommon,
        ),
        success: cn(
          "border shadow-xs",
          "bg-success hover:bg-success/90",
          "text-success-foreground",
          "border-success",
          activeCommon,
        ),
        warn: cn(
          "border shadow-xs",
          "bg-action hover:bg-action-hover",
          "text-action-foreground",
          "border-action-hover",
          activeCommon,
        ),
        action: cn(
          "bg-action text-action-foreground shadow-xs",
          "hover:bg-action-hover border border-action",
          activeCommon,
        ),
        outline: cn(
          "border border-input shadow-xs",
          "hover:bg-accent hover:text-accent-foreground",
          "hover:border-primary",
          "aria-selected:text-accent-foreground aria-selected:border-primary",
          activeCommon,
        ),
        secondary: cn(
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          "border border-input shadow-xs",
          activeCommon,
        ),
        text: cn("opacity-80 hover:opacity-100", "active:opacity-100"),
        ghost: cn(
          "border border-transparent",
          "hover:bg-accent hover:text-accent-foreground hover:shadow-xs",
          activeCommon,
          "active:text-accent-foreground",
        ),
        link: "underline-offset-4 hover:underline text-link",
        linkDestructive:
          "underline-offset-4 hover:underline text-destructive underline-destructive",
        outlineDestructive:
          "border border-destructive text-destructive hover:bg-destructive/10",
      },
      size: {
        default: "h-10 py-2 px-4",
        xs: "h-7 px-2 rounded-md text-xs",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-6 w-6",
      },
      disabled: {
        true: "opacity-50 pointer-events-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "disabled"> {
  asChild?: boolean;
  keyboardShortcut?: string;
  /** Shows a spinner and sets `aria-busy`; also disables the button. */
  loading?: boolean;
  /** Stretches the button to fill its container. */
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      keyboardShortcut,
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    // Warn (dev only) when an icon-only button lacks an accessible name —
    // the most common a11y slip in this codebase.
    if (
      process.env.NODE_ENV !== "production" &&
      size === "icon" &&
      !props["aria-label"] &&
      !props["aria-labelledby"]
    ) {
      Logger.warn(
        "Button: icon-only buttons must have an `aria-label` or `aria-labelledby`.",
      );
    }

    const buttonRef = React.useRef<HTMLButtonElement>(null);

    React.useImperativeHandle(
      ref,
      // oxlint-disable-next-line typescript/non-nullable-type-assertion-style
      () => buttonRef.current as HTMLButtonElement,
    );

    const handleKeyPress = React.useCallback(
      (e: KeyboardEvent) => {
        if (!keyboardShortcut || e.defaultPrevented) {
          return;
        }

        if (Events.shouldIgnoreKeyboardEvent(e)) {
          return;
        }

        if (parseShortcut(keyboardShortcut)(e)) {
          e.preventDefault();
          e.stopPropagation();
          if (buttonRef?.current && !buttonRef.current.disabled) {
            buttonRef.current.click();
          }
        }
      },
      [keyboardShortcut],
    );

    useEventListener(document, "keydown", handleKeyPress);

    const Comp = asChild ? SlotPrimitive.Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({
            variant,
            size,
            className,
            disabled: disabled || loading,
          }),
          fullWidth && "w-full",
          className,
        )}
        aria-busy={loading || undefined}
        ref={buttonRef}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Spinner size="small" className="text-current" /> : children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
