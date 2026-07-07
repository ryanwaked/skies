/* Copyright 2026 Marimo. All rights reserved. */
import clsx from "clsx";

interface Props {
  className?: string;
  children: React.ReactNode;
}

export const Kbd: React.FC<Props> = (props) => {
  return (
    <kbd
      className={clsx(
        props.className,
        // A little keyboard key cap: hairline border with a slightly heavier
        // bottom edge for depth, square-ish min width so single keys read as
        // caps rather than loose glyphs.
        "inline-flex min-w-[1.5em] items-center justify-center whitespace-nowrap rounded-[4px] border border-border border-b-[1.5px] bg-muted/50 px-1.5 py-px text-[0.7rem] font-medium leading-[1.4] text-muted-foreground",
      )}
    >
      {props.children}
    </kbd>
  );
};
