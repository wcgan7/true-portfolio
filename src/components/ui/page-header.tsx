import { Box, Stack, Typography } from "@mui/material";

export function PageHeader(props: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h1" component="h1" sx={{ mb: 0.75 }}>
          {props.title}
        </Typography>
        {props.subtitle ? (
          <Typography variant="body1" color="text.secondary">
            {props.subtitle}
          </Typography>
        ) : null}
      </Box>
      {props.actions ? <Box>{props.actions}</Box> : null}
    </Stack>
  );
}
