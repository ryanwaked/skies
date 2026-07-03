/* Copyright 2026 Marimo. All rights reserved. */
import { PrimitiveType } from "compassql/build/src/schema";
import {
  CalendarIcon,
  HashIcon,
  ListOrderedIcon,
  ToggleLeftIcon,
  TypeIcon,
} from "lucide-react";

/**
 * Icon mapping from PrimitiveType to Lucid icon
 */
export const PRIMITIVE_TYPE_ICON: Record<PrimitiveType, React.ReactNode> = {
  [PrimitiveType.BOOLEAN]: (
    <ToggleLeftIcon
      className="h-4 w-4 inline-flex text-muted-foreground"
      strokeWidth={1.5}
    />
  ),
  [PrimitiveType.DATETIME]: (
    <CalendarIcon
      className="h-4 w-4 inline-flex text-muted-foreground"
      strokeWidth={1.5}
    />
  ),
  [PrimitiveType.NUMBER]: (
    <HashIcon
      className="h-4 w-4 inline-flex text-muted-foreground"
      strokeWidth={1.5}
    />
  ),
  [PrimitiveType.STRING]: (
    <TypeIcon
      className="h-4 w-4 inline-flex text-muted-foreground"
      strokeWidth={1.5}
    />
  ),
  [PrimitiveType.INTEGER]: (
    <ListOrderedIcon
      className="h-4 w-4 inline-flex text-muted-foreground"
      strokeWidth={1.5}
    />
  ),
};
