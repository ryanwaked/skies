/* Copyright 2026 Marimo. All rights reserved. */
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

interface SidebarToggleProps {
  isOpen: boolean;
  toggle: () => void;
}

export const SidebarToggle = ({ isOpen, toggle }: SidebarToggleProps) => {
  return (
    <div className="invisible lg:visible absolute top-[12px] right-[16px] z-20">
      <Button onClick={toggle} className="w-10 h-8" variant="ghost" size="icon">
        <ChevronLeft
          strokeWidth={1.5}
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform ease-in-out duration-700",
            isOpen ? "rotate-0" : "rotate-180",
          )}
        />
      </Button>
    </div>
  );
};
