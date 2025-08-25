import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface DataTableProps {
  data: any[];
  queryType: string;
}

export function DataTable({ data, queryType }: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="table-empty">
        No data available
      </div>
    );
  }

  const renderTimeEntriesTable = () => (
    <div className="overflow-x-auto bg-gray-50 rounded-lg border" data-testid="table-time-entries">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry, index) => (
            <TableRow key={entry.id || index} data-testid={`row-time-entry-${index}`}>
              <TableCell className="font-mono text-sm">
                {new Date(entry.spent_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'numeric',
                  day: 'numeric'
                })}
              </TableCell>
              <TableCell className="font-medium">{entry.project?.name || 'N/A'}</TableCell>
              <TableCell>{entry.task?.name || 'N/A'}</TableCell>
              <TableCell className="font-semibold">{entry.hours}h</TableCell>
              <TableCell className="max-w-xs truncate">{entry.notes || '-'}</TableCell>
              <TableCell>
                <Badge variant={entry.billable ? "default" : "secondary"}>
                  {entry.billable ? "Billable" : "Non-billable"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderProjectsTable = () => (
    <div className="overflow-x-auto bg-gray-50 rounded-lg border" data-testid="table-projects">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((project, index) => (
            <TableRow key={project.id || index} data-testid={`row-project-${index}`}>
              <TableCell className="font-medium">{project.name}</TableCell>
              <TableCell className="font-mono text-sm">{project.code || '-'}</TableCell>
              <TableCell>{project.client?.name || 'N/A'}</TableCell>
              <TableCell>{project.budget ? `$${project.budget.toLocaleString()}` : '-'}</TableCell>
              <TableCell>
                <Badge variant={project.is_active ? "default" : "secondary"}>
                  {project.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderClientsTable = () => (
    <div className="overflow-x-auto bg-gray-50 rounded-lg border" data-testid="table-clients">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((client, index) => (
            <TableRow key={client.id || index} data-testid={`row-client-${index}`}>
              <TableCell className="font-medium">{client.name}</TableCell>
              <TableCell className="max-w-xs truncate">{client.address || '-'}</TableCell>
              <TableCell>
                <Badge variant={client.is_active ? "default" : "secondary"}>
                  {client.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  switch (queryType) {
    case 'time_entries':
    case 'summary':
      return renderTimeEntriesTable();
    case 'projects':
      return renderProjectsTable();
    case 'clients':
      return renderClientsTable();
    default:
      return renderTimeEntriesTable();
  }
}
