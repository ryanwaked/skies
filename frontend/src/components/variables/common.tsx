/* Copyright 2026 Marimo. All rights reserved. */
import React from "react";
import { cn } from "@/utils/cn";
import { copyToClipboard } from "@/utils/copy";
import { toast } from "../ui/use-toast";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  declaredBy: string[];
}

export const VariableName: React.FC<Props> = ({
  name,
  declaredBy,
  onClick,
  ...rest
}) => {
  return (
    <div className="max-w-[130px]" {...rest}>
      {/* Hex data browser: variable names are plain 12px mono text, no chip.
          Multiple declarations keep the error color as a conflict signal. */}
      <div
        title={name}
        className={cn(
          "font-code text-xs block max-w-fit overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer",
          declaredBy.length > 1 ? "text-error" : "text-foreground",
          "hover:text-primary",
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
