"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { materialTheme } from "@/src/theme/material-theme";

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={materialTheme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
