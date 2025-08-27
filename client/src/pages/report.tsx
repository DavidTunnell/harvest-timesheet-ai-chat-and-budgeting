import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { Link } from 'wouter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Project {
  id: number;
  name: string;
  totalHours: number;
  budget: number;
  budgetSpent: number;
  budgetRemaining: number;
  billedAmount: number;
  billableHours: number;
  budgetPercentComplete: number;
}

interface ReportData {
  projects: Project[];
  bhsProjects: Project[];
  summary: {
    totalHours: number;
    projectCount: number;
    reportDate: string;
  };
}

export default function Report() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const monthParam = urlParams.get('month');
    return monthParam || `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Generate month options for the past 2 years
  const monthOptions = [];
  const currentDate = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    monthOptions.push({ value, label });
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('month', selectedMonth);
    window.history.replaceState({}, '', url.toString());
  }, [selectedMonth]);

  const { data: reportData, isLoading: reportLoading } = useQuery<ReportData>({
    queryKey: ['/api/reports/data', selectedMonth],
    queryFn: () => fetch(`/api/reports/data?month=${selectedMonth}`).then(res => res.json()),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Navigation */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Monthly Report</h1>
            </div>
            <Link href="/">
              <Button variant="outline" className="flex items-center space-x-2">
                <MessageCircle size={18} />
                <span>Chat</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="report-content">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white p-8 rounded-lg mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Monthly Project Budget Report</h1>
          <p className="text-orange-100">
            {reportData?.summary?.reportDate || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Month-to-Date Summary</h2>
          <p className="text-gray-600">This report shows the total hours and budget utilization for each project so far this month.</p>
        </div>

        {reportLoading ? (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading real project data from Harvest...</p>
          </div>
        ) : reportData && reportData.projects && reportData.projects.length > 0 ? (
          <div className="space-y-8 mb-8">
            {/* Month Selector */}
            <div className="flex items-center justify-end mb-6" data-testid="month-selector">
              <div className="flex items-center space-x-4">
                <Label htmlFor="month-select" className="text-lg font-semibold text-gray-800">
                  Select Month:
                </Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-64" id="month-select">
                    <SelectValue placeholder="Select a month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Hours</h3>
                <div className="text-3xl font-bold text-gray-900">{reportData.summary.totalHours.toFixed(1)}h</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Budget</h3>
                <div className="text-3xl font-bold text-gray-900">
                  ${(reportData.projects.reduce((sum, p) => sum + p.budget, 0) + 
                     (reportData.bhsProjects?.reduce((sum, p) => sum + p.budget, 0) || 0)).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Billable Hours</h3>
                <div className="text-3xl font-bold text-gray-900">
                  {(reportData.projects.reduce((sum, p) => sum + p.billableHours, 0) + 
                    (reportData.bhsProjects?.reduce((sum, p) => sum + p.totalHours, 0) || 0)).toFixed(1)}h
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Billed</h3>
                <div className="text-3xl font-bold text-gray-900">
                  ${reportData.projects.reduce((sum, p) => sum + p.billedAmount, 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Primary Projects Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Primary Projects</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Project Name</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Hours Logged</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Budget</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Budget %</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Billable Hours</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Billed Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.projects.map((project) => {
                      const getStatusColor = (percentage: number) => {
                        if (percentage > 100) return 'text-red-600 font-semibold';
                        if (percentage >= 85) return 'text-yellow-600 font-semibold';
                        return 'text-green-600 font-semibold';
                      };

                      return (
                        <tr key={project.id}>
                          <td className="px-3 py-4 text-sm text-gray-900">{project.name}</td>
                          <td className="px-3 py-4 text-sm text-center text-gray-500">{project.totalHours.toFixed(1)}h</td>
                          <td className="px-3 py-4 text-sm text-center text-gray-500">${project.budget.toLocaleString()}</td>
                          <td className={`px-3 py-4 text-sm text-center ${getStatusColor(project.budgetPercentComplete)}`}>
                            {project.budgetPercentComplete.toFixed(1)}%
                          </td>
                          <td className="px-3 py-4 text-sm text-center text-gray-500">{project.billableHours.toFixed(1)}h</td>
                          <td className="px-3 py-4 text-sm text-center text-gray-500">${project.billedAmount.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BHS Projects Table */}
            {reportData.bhsProjects && reportData.bhsProjects.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Hosting Support (BHS) Projects</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Client Name</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Hours Logged</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Support Hours</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Budget %</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Total Budget</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.bhsProjects.map((project, index) => {
                        const supportHours = Math.round(project.budget / 150);
                        const budgetPercentage = supportHours > 0 ? (project.totalHours / supportHours * 100) : 0;
                        
                        const getStatusColor = (percentage: number) => {
                          if (percentage > 100) return 'text-red-600 font-semibold';
                          if (percentage >= 85) return 'text-yellow-600 font-semibold';
                          return 'text-green-600 font-semibold';
                        };

                        const clientName = project.name.replace(' - Basic Hosting Support', '');

                        return (
                          <tr key={`bhs-${index}`}>
                            <td className="px-3 py-4 text-sm text-gray-900">{clientName}</td>
                            <td className="px-3 py-4 text-sm text-center text-gray-500">{project.totalHours.toFixed(1)}h</td>
                            <td className="px-3 py-4 text-sm text-center text-gray-500">{supportHours}h</td>
                            <td className={`px-3 py-4 text-sm text-center ${getStatusColor(budgetPercentage)}`}>
                              {budgetPercentage.toFixed(1)}%
                            </td>
                            <td className="px-3 py-4 text-sm text-center text-gray-500">${project.budget.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No project data available</h3>
            <p className="text-gray-500">Please check your Harvest connection or try a different month.</p>
          </div>
        )}
      </div>
    </div>
  );
}