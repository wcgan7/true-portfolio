import { Card, CardContent, Stack, Typography } from "@mui/material";

export function SectionCard(props: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  testId?: string;
  compact?: boolean;
}) {
  return (
    <Card data-testid={props.testId}>
      <CardContent sx={{ p: props.compact ? 2 : 2.5, "&:last-child": { pb: props.compact ? 2 : 2.5 } }}>
        {props.title ? (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography component="h2" variant="h2">
              {props.title}
            </Typography>
            {props.subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {props.subtitle}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
        {props.children}
      </CardContent>
    </Card>
  );
}
