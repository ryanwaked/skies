/* Copyright 2026 Marimo. All rights reserved. */
import { memo, type PropsWithChildren, useLayoutEffect } from "react";
import { useTheme } from "./useTheme";

/**
 * Marimo's theme provider.
 */
export const ThemeProvider: React.FC<PropsWithChildren> = memo(
  ({ children }) => {
    const { theme } = useTheme();
    useLayoutEffect(() => {
      // Apply to <html> as well as <body>: the document canvas (painted from
      // the root element's background during inter-document navigation gaps)
      // must follow runtime theme changes, and the pre-paint bootstrap in
      // index.html puts the class on <html>. The body application is kept
      // for backwards compatibility with anything reading `body.dark`.
      const root = document.documentElement;
      // The pre-paint bootstrap in index.html sets a literal inline
      // background as a pre-CSS bridge; clear it now that the stylesheet is
      // live so the canvas follows --background (and this effect) instead.
      root.style.removeProperty("background-color");
      root.classList.add(theme, `${theme}-theme`);
      root.dataset.theme = theme;
      document.body.classList.add(theme, `${theme}-theme`);
      document.body.dataset.theme = theme;
      return () => {
        root.classList.remove(theme, `${theme}-theme`);
        delete root.dataset.theme;
        document.body.classList.remove(theme, `${theme}-theme`);
        delete document.body.dataset.theme;
      };
    }, [theme]);

    return children;
  },
);
ThemeProvider.displayName = "ThemeProvider";

export const CssVariables: React.FC<{
  variables: Record<`--marimo-${string}`, string>;
  children: React.ReactNode;
}> = ({ variables, children }) => {
  return (
    <div className="contents" style={variables}>
      {children}
    </div>
  );
};
