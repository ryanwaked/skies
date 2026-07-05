/* Copyright 2026 Marimo. All rights reserved. */

import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";
import { useLocale } from "react-aria";
import { cn } from "@/utils/cn";
import { prettyScientificNumber } from "@/utils/numbers";
import { useBoolean } from "../../hooks/useBoolean";
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "./tooltip";
import { sliderRange, sliderThumb, sliderTrack } from "./styles";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    valueMap: (sliderValue: number) => number;
  }
>(({ className, valueMap, ...props }, ref) => {
  const [open, openActions] = useBoolean(false);
  const { locale } = useLocale();

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex touch-none select-none hover:cursor-pointer",
        "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:items-center",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:justify-center",
        "data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-testid="track"
        className={cn(
          sliderTrack,
          "data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2",
        )}
      >
        <SliderPrimitive.Range
          data-testid="range"
          className={cn(
            sliderRange,
            "data-[orientation=horizontal]:h-full",
            "data-[orientation=vertical]:w-full",
            "data-disabled:opacity-50",
          )}
        />
      </SliderPrimitive.Track>
      <TooltipProvider>
        <TooltipRoot delayDuration={0} open={open}>
          <TooltipTrigger asChild={true}>
            <SliderPrimitive.Thumb
              data-testid="thumb"
              className={cn(
                sliderThumb,
                "onFocus:data-[state=open]:bg-accent",
              )}
              onFocus={openActions.setTrue}
              onBlur={openActions.setFalse}
              onMouseEnter={openActions.setTrue}
              onMouseLeave={openActions.setFalse}
            />
          </TooltipTrigger>
          <TooltipPortal>
            {props.value != null && props.value.length === 1 && (
              <TooltipContent key={props.value[0]}>
                {prettyScientificNumber(valueMap(props.value[0]), { locale })}
              </TooltipContent>
            )}
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
