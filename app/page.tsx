import { Box, Card, CardActionArea, CardContent, Grid, Typography } from "@mui/material";

const QUICK_ACTIONS = [
  {
    title: "Overview",
    description: "Inspect totals, classifications, and exposure analytics.",
    href: "/overview",
    cta: "Open Overview",
  },
  {
    title: "Accounts",
    description: "Create and manage portfolio accounts.",
    href: "/accounts",
    cta: "Open Accounts",
  },
  {
    title: "Transactions",
    description: "Create instruments and post portfolio transactions.",
    href: "/transactions",
    cta: "Open Transactions",
  },
  {
    title: "Valuations",
    description: "Refresh prices, recompute, and inspect daily valuations.",
    href: "/valuations",
    cta: "Open Valuations",
  },
];

export default function Home() {
  return (
    <Box component="main" sx={{ display: "grid", gap: 3 }}>
      <Box>
        <Typography variant="h1" component="h1" sx={{ mb: 1 }}>
          True Portfolio
        </Typography>
        <Typography variant="body1">Trust-first portfolio analytics.</Typography>
      </Box>

      <Grid container spacing={2}>
        {QUICK_ACTIONS.map((item) => (
          <Grid key={item.href} size={{ xs: 12, sm: 6 }}>
            <Card>
              <CardActionArea component="a" href={item.href}>
                <CardContent>
                  <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {item.description}
                  </Typography>
                  <Typography color="primary" sx={{ fontWeight: 600 }}>
                    {item.cta}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
