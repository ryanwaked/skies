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
        // text-[0.75rem]: don't want to set line height; want to inherit
        // whatever line height is used to make sure text is not off-center
        "rounded-lg bg-muted/40 px-2 text-[0.75rem] font-prose center border border-border text-muted-foreground block whitespace-nowrap",
      )}
    >
      {props.children}
    </kbd>
  );
};
