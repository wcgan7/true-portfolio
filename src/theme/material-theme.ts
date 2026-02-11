import { alpha, createTheme } from "@mui/material/styles";

const financeBlue = "#0B5CAB";

export const materialTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: financeBlue,
      light: "#5A8ED1",
      dark: "#003D73",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#1F4A75",
      light: "#4A6F94",
      dark: "#153553",
    },
    background: {
      default: "#F3F6FB",
      paper: "#FFFFFF",
    },
    success: {
      main: "#2E7D32",
    },
    warning: {
      main: "#ED6C02",
    },
    error: {
      main: "#C62828",
    },
    info: {
      main: "#0288D1",
    },
  },
  shape: {
    borderRadius: 14,
  },
  spacing: 8,
  typography: {
    fontFamily: 'var(--font-geist-sans), "Segoe UI", sans-serif',
    h1: {
      fontSize: "2rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontSize: "1.4rem",
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontSize: "1.1rem",
      fontWeight: 600,
    },
    body2: {
      color: "#495a70",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          background:
            "radial-gradient(circle at 0% 0%, rgba(11,92,171,0.08), transparent 35%), radial-gradient(circle at 100% 0%, rgba(11,92,171,0.06), transparent 25%), #F3F6FB",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #E1E8F2",
          boxShadow: "0px 8px 28px rgba(11, 39, 77, 0.08)",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          whiteSpace: "nowrap",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          textUnderlineOffset: 2,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          border: "1px solid #E1E8F2",
          borderRadius: 14,
          background: "#FFFFFF",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: `2px solid ${alpha(financeBlue, 0.45)}`,
            outlineOffset: 2,
          },
        },
      },
    },
  },
});
