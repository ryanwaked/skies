/* Copyright 2026 Marimo. All rights reserved. */

import {
  Grid3x3Icon,
  ListIcon,
  PresentationIcon,
  SquareIcon,
} from "lucide-react";
import type React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFeatureFlag } from "@/core/config/feature-flag";
import { useLayoutActions, useLayoutState } from "@/core/layout/layout";
import { isWasm } from "@/core/wasm/utils";
import { logNever } from "@/utils/assertNever";
import { Strings } from "@/utils/strings";
import { LAYOUT_TYPES, type LayoutType } from "./types";

export const LayoutSelect: React.FC = () => {
  const { selectedLayout } = useLayoutState();
  const { setLayoutView } = useLayoutActions();

  // Layouts are not supported in WASM mode by default,
  // unless the feature flag is enabled
  if (isWasm() && !getFeatureFlag("wasm_layouts")) {
    return null;
  }

  return (
    <Select
      data-testid="layout-select"
      value={selectedLayout}
      onValueChange={(v) => setLayoutView(v as LayoutType)}
    >
      <SelectTrigger
        // Compact flat select sized to the h-7 header chrome, with the same
        // neutral hover wash as the other top-bar controls.
        className="h-7 min-w-[110px] bg-background transition-colors hover:bg-[rgba(63,66,87,0.2)]"
        data-testid="layout-select"
      >
        <SelectValue placeholder="Select a view" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>View as</SelectLabel>
          {LAYOUT_TYPES.map((layout) => (
            <SelectItem key={layout} value={layout}>
              <div className="flex items-center gap-1.5 leading-5">
                {renderIcon(layout)}
                <span>{displayLayoutName(layout)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

function renderIcon(layoutType: LayoutType) {
  const Icon = getLayoutIcon(layoutType);
  return <Icon className="h-4 w-4" strokeWidth={1.5} />;
}

export function getLayoutIcon(layoutType: LayoutType) {
  switch (layoutType) {
    case "vertical":
      return ListIcon;
    case "grid":
      return Grid3x3Icon;
    case "slides":
      return PresentationIcon;
    default:
      logNever(layoutType);
      return SquareIcon;
  }
}

export function displayLayoutName(layoutType: LayoutType) {
  return Strings.startCase(layoutType);
}
