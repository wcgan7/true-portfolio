import { Card, CardContent, Link as MuiLink, Typography } from "@mui/material";

export function KpiCard(props: {
  label: string;
  value: string;
  href: string;
  testId: string;
}) {
  return (
    <Card>
      <CardContent>
        <MuiLink
          href={props.href}
          data-testid={props.testId}
          underline="hover"
          color="primary"
          sx={{ fontWeight: 700 }}
        >
          {props.label}
        </MuiLink>
        <Typography component="p" variant="h5" sx={{ mt: 1.5, fontWeight: 700 }}>
          {props.value}
        </Typography>
      </CardContent>
    </Card>
  );
}
