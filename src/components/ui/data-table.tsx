import { Paper, Table, TableContainer } from "@mui/material";

export function DataTable(props: {
  children: React.ReactNode;
  testId?: string;
  compact?: boolean;
}) {
  return (
    <TableContainer component={Paper} data-testid={props.testId}>
      <Table size={props.compact ? "small" : "medium"}>{props.children}</Table>
    </TableContainer>
  );
}
