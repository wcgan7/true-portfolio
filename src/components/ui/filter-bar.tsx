import { Stack } from "@mui/material";
import { SectionCard } from "@/src/components/ui/section-card";

export function FilterBar(props: { children: React.ReactNode }) {
  return (
    <SectionCard compact>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", md: "flex-end" }}
      >
        {props.children}
      </Stack>
    </SectionCard>
  );
}
