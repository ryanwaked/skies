/* Copyright 2026 Marimo. All rights reserved. */
import React from "react";
import { cn } from "@/utils/cn";
import { copyToClipboard } from "@/utils/copy";
import { toast } from "../ui/use-toast";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  declaredBy: string[];
  /**
   * Kernel-reported type; drives the chip color (Hex semantics — green for
   * dataframe-shaped values, neutral for modules, blue for everything else).
   */
  dataType?: string | null;
}

/** Hex chip semantics: dataframes read green, modules neutral, refs blue. */
function chipClasses(dataType: string | null | undefined, conflict: boolean) {
  if (conflict) {
    return "bg-error/10 border-error/30 text-error";
  }
  if (dataType && /frame|series|^table$/i.test(dataType)) {
    return cn(
      "bg-[color-mix(in_srgb,var(--success)_13%,transparent)] border-transparent",
      "text-[var(--success)] hover:border-[color-mix(in_srgb,var(--success)_40%,transparent)]",
    );
  }
  if (dataType === "module") {
    return "bg-muted border-transparent text-muted-foreground hover:border-input";
  }
  return "bg-accent border-transparent text-accent-foreground hover:border-primary/40";
}

export const VariableName: React.FC<Props> = ({
  name,
  declaredBy,
  dataType,
  onClick,
  ...rest
}) => {
  return (
    <div className="min-w-0 max-w-full" {...rest}>
      {/* Variable names are mono chips, color-coded by kind like Hex's
          pills. Multiple declarations swap to the error tint as a
          conflict signal. */}
      <div
        title={name}
        className={cn(
          "font-code text-[11.5px] inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer",
          "rounded-[3px] px-1.5 py-0.5 border",
          chipClasses(dataType, declaredBy.length > 1),
        )}
        onClick={async (evt) => {
          if (onClick) {
            onClick(evt);
            return;
          }
          await copyToClipboard(name);
          toast({ title: "Copied to clipboard" });
        }}
      >
        {name}
      </div>
    </div>
  );
};
