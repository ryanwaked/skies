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
    <div className="min-w-0 max-w-full" {...rest}>
      {/* Data browser: variable names are mono chips on a sky-blue tint,
          matching Hex's variable pills. Multiple declarations swap to the
          error tint as a conflict signal. */}
      <div
        title={name}
        className={cn(
          "font-code text-[11.5px] inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer",
          "rounded-[3px] px-1.5 py-0.5 border",
          declaredBy.length > 1
            ? "bg-error/10 border-error/30 text-error"
            : "bg-accent border-transparent text-accent-foreground hover:border-primary/40",
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
