import { Alert } from "@mui/material";

export function InlineAlert(props: {
  severity: "error" | "warning" | "info" | "success";
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Alert severity={props.severity} role={props.severity === "error" ? "alert" : undefined} data-testid={props.testId}>
      {props.children}
    </Alert>
  );
}
