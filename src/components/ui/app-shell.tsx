"use client";

import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Overview", href: "/overview" },
  { label: "Accounts", href: "/accounts" },
  { label: "Transactions", href: "/transactions" },
  { label: "Valuations", href: "/valuations" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = useMemo(
    () =>
      NAV_ITEMS.map((item) => (
        <Button
          key={item.href}
          component={Link}
          href={item.href}
          color={isActive(pathname, item.href) ? "primary" : "inherit"}
          variant={isActive(pathname, item.href) ? "contained" : "text"}
          sx={{ minWidth: 0 }}
        >
          {item.label}
        </Button>
      )),
    [pathname],
  );

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Container maxWidth="xl">
          <Toolbar sx={{ minHeight: 74, px: { xs: 0, md: 1 } }}>
            <Typography
              component={Link}
              href="/"
              variant="h6"
              sx={{
                textDecoration: "none",
                color: "text.primary",
                fontWeight: 800,
                letterSpacing: "0.01em",
                flexGrow: 1,
              }}
            >
              True Portfolio
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              sx={{ display: { xs: "none", md: "flex" } }}
              data-testid="app-shell-nav"
              aria-label="Primary navigation"
            >
              {nav}
            </Stack>

            <IconButton
              sx={{ display: { xs: "inline-flex", md: "none" } }}
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              data-testid="app-shell-mobile-menu-btn"
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        data-testid="app-shell-mobile-drawer"
      >
        <Stack spacing={1.5} sx={{ p: 2, minWidth: 220 }}>
          {NAV_ITEMS.map((item) => (
            <Button
              key={`mobile-${item.href}`}
              component={Link}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              color={isActive(pathname, item.href) ? "primary" : "inherit"}
              variant={isActive(pathname, item.href) ? "contained" : "outlined"}
              sx={{ justifyContent: "flex-start" }}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </Drawer>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
        {children}
      </Container>
    </Box>
  );
}
