/* Copyright 2026 Marimo. All rights reserved. */

import { LoaderCircle, XIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { TreeChevron } from "@/components/editor/file-tree/tree-actions";
import type { DataType } from "@/core/kernel/messages";
import { cn } from "@/utils/cn";
import { DATA_TYPE_ICON } from "../datasets/icons";

export const RotatingChevron: React.FC<{ isExpanded: boolean }> = ({
  isExpanded,
}) => (
  <TreeChevron
    isExpanded={isExpanded}
    className="h-3 w-3 text-muted-foreground [stroke-width:1.5]"
  />
);

export const DatasourceLabel: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}> = ({ children, className, style }) => {
  return (
    <div
      className={cn(
        // Hex section header: 10px/600 uppercase, 0.05em tracking, muted color
        "flex gap-1.5 items-center py-1.5 text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.05em]",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
};

export const EmptyState: React.FC<{
  content: string;
  className?: string;
  style?: CSSProperties;
}> = ({ content, className, style }) => {
  return (
    <div
      className={cn("text-xs text-muted-foreground py-1", className)}
      style={style}
    >
      {content}
    </div>
  );
};

export const ErrorState: React.FC<{
  error: Error;
  style?: CSSProperties;
  className?: string;
  showIcon?: boolean;
}> = ({ error, style, className, showIcon = true }) => {
  return (
    <div
      className={cn(
        "text-xs bg-error/10 text-error rounded-sm flex items-center gap-2 p-2 h-7",
        className,
      )}
      style={style}
    >
      {showIcon && <XIcon className="h-3.5 w-3.5" strokeWidth={1.5} />}
      {error.message}
    </div>
  );
};

export const LoadingState: React.FC<{
  message: string;
  className?: string;
  style?: CSSProperties;
}> = ({ message, className, style }) => {
  return (
    <div
      className={cn(
        "text-xs text-muted-foreground flex items-center gap-2 p-2 h-7",
        className,
      )}
      style={style}
    >
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
      {message}
    </div>
  );
};

export const ColumnPreviewContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn("flex flex-col gap-2 relative", className)}>
      {children}
    </div>
  );
};

export const ColumnName = ({
  columnName,
  dataType,
}: {
  columnName: React.ReactNode;
  dataType: DataType;
}) => {
  const Icon = DATA_TYPE_ICON[dataType];

  // Hex data browser: type icons are quiet, thin-stroke, muted glyphs —
  // no colored chips.
  return (
    <div className="flex flex-row items-center gap-1.5">
      <Icon
        className="w-3.5 h-3.5 shrink-0 text-muted-foreground"
        strokeWidth={1.5}
      />
      {columnName}
    </div>
  );
};
