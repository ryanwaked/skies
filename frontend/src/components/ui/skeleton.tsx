/* Copyright 2026 Marimo. All rights reserved. */
import { cn } from "@/utils/cn";

const Skeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn("motion-safe:animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
};

export { Skeleton };
