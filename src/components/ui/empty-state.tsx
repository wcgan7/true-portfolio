import { Box, Typography } from "@mui/material";

export function EmptyState(props: { title: string; body?: string }) {
  return (
    <Box
      sx={{
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        textAlign: "center",
        backgroundColor: "rgba(255,255,255,0.7)",
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {props.title}
      </Typography>
      {props.body ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {props.body}
        </Typography>
      ) : null}
    </Box>
  );
}
