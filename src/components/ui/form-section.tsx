import { Stack } from "@mui/material";
import { SectionCard } from "@/src/components/ui/section-card";

export function FormSection(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <SectionCard title={props.title} subtitle={props.subtitle}>
      <Stack component="div" spacing={2}>
        {props.children}
      </Stack>
    </SectionCard>
  );
}
