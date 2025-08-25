import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign, Briefcase, Users } from "lucide-react";

interface SummaryCardProps {
  summary: {
    totalHours?: number;
    billableHours?: number;
    nonBillableHours?: number;
    projectCount?: number;
    clientCount?: number;
    averageDaily?: number;
    projects?: string[];
    clients?: string[];
  };
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const {
    totalHours = 0,
    billableHours = 0,
    nonBillableHours = 0,
    projectCount = 0,
    clientCount = 0,
    averageDaily = 0,
    projects = [],
    clients = []
  } = summary;

  return (
    <Card className="bg-green-50 border-green-200" data-testid="card-summary">
      <CardHeader>
        <CardTitle className="text-green-800 flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center" data-testid="stat-total-hours">
            <div className="text-2xl font-bold text-green-700">{totalHours}h</div>
            <div className="text-sm text-green-600">Total Hours</div>
          </div>
          <div className="text-center" data-testid="stat-billable-hours">
            <div className="text-2xl font-bold text-green-700">{billableHours}h</div>
            <div className="text-sm text-green-600">Billable</div>
          </div>
          <div className="text-center" data-testid="stat-projects">
            <div className="text-2xl font-bold text-green-700">{projectCount}</div>
            <div className="text-sm text-green-600">Projects</div>
          </div>
          <div className="text-center" data-testid="stat-average">
            <div className="text-2xl font-bold text-green-700">{averageDaily}h</div>
            <div className="text-sm text-green-600">Avg Daily</div>
          </div>
        </div>

        {nonBillableHours > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">Non-billable Hours:</span>
              <span className="font-semibold text-green-700">{nonBillableHours}h</span>
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-green-800 mb-2 flex items-center space-x-1">
              <Briefcase className="h-4 w-4" />
              <span>Projects Worked On:</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {projects.map((project, index) => (
                <span 
                  key={index} 
                  className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-sm"
                  data-testid={`project-${index}`}
                >
                  {project}
                </span>
              ))}
            </div>
          </div>
        )}

        {clients.length > 0 && (
          <div>
            <h4 className="font-medium text-green-800 mb-2 flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>Clients:</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {clients.map((client, index) => (
                <span 
                  key={index} 
                  className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-sm"
                  data-testid={`client-${index}`}
                >
                  {client}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
