import axios from 'axios';
import { HarvestTimeEntry, HarvestProject, HarvestClient, ParsedQuery } from '@shared/schema';

const HARVEST_BASE_URL = 'https://api.harvestapp.com/v2';

interface HarvestConfig {
  accountId: string;
  accessToken: string;
}

export class HarvestService {
  private config: HarvestConfig;

  constructor(config: HarvestConfig) {
    this.config = config;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Harvest-Account-Id': this.config.accountId,
      'User-Agent': 'Harvest Chat Assistant (support@example.com)',
      'Content-Type': 'application/json'
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${HARVEST_BASE_URL}/users/me`, {
        headers: this.getHeaders()
      });
      return response.status === 200;
    } catch (error) {
      console.error('Harvest connection test failed:', error);
      return false;
    }
  }

  async getTimeEntries(params: ParsedQuery['parameters']): Promise<HarvestTimeEntry[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.dateRange?.from) {
        queryParams.append('from', params.dateRange.from);
      }
      if (params.dateRange?.to) {
        queryParams.append('to', params.dateRange.to);
      }
      if (params.userId) {
        queryParams.append('user_id', params.userId.toString());
      }
      if (params.projectId) {
        queryParams.append('project_id', params.projectId.toString());
      }
      if (params.clientId) {
        queryParams.append('client_id', params.clientId.toString());
      }

      const response = await axios.get(`${HARVEST_BASE_URL}/time_entries?${queryParams.toString()}`, {
        headers: this.getHeaders()
      });

      let entries = response.data.time_entries || [];
      
      // Apply client-side filtering for user names if specified
      if (params.filters && (params.filters.userName || params.filters.user)) {
        const searchName = (params.filters.userName || params.filters.user).toLowerCase();
        entries = entries.filter(entry => {
          const userName = entry.user?.name?.toLowerCase() || '';
          return userName.includes(searchName);
        });
      }

      return entries;
    } catch (error) {
      console.error('Error fetching time entries:', error);
      throw new Error('Failed to fetch time entries from Harvest API');
    }
  }

  async getProjects(): Promise<HarvestProject[]> {
    try {
      const response = await axios.get(`${HARVEST_BASE_URL}/projects`, {
        headers: this.getHeaders()
      });

      return response.data.projects || [];
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw new Error('Failed to fetch projects from Harvest API');
    }
  }

  async getClients(): Promise<HarvestClient[]> {
    try {
      const response = await axios.get(`${HARVEST_BASE_URL}/clients`, {
        headers: this.getHeaders()
      });

      return response.data.clients || [];
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw new Error('Failed to fetch clients from Harvest API');
    }
  }

  async getCurrentUser() {
    try {
      const response = await axios.get(`${HARVEST_BASE_URL}/users/me`, {
        headers: this.getHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw new Error('Failed to fetch user information from Harvest API');
    }
  }

  generateSummary(data: any[], queryType: string, summaryType?: string) {
    if (queryType === 'time_entries') {
      const totalHours = data.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const billableHours = data.filter(entry => entry.billable).reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const projects = Array.from(new Set(data.map(entry => entry.project?.name))).filter(Boolean);
      const clients = Array.from(new Set(data.map(entry => entry.client?.name))).filter(Boolean);

      return {
        totalHours: Math.round(totalHours * 10) / 10,
        billableHours: Math.round(billableHours * 10) / 10,
        nonBillableHours: Math.round((totalHours - billableHours) * 10) / 10,
        projectCount: projects.length,
        clientCount: clients.length,
        averageDaily: data.length > 0 ? Math.round((totalHours / data.length) * 10) / 10 : 0,
        projects,
        clients
      };
    }

    return null;
  }
}

export function getDateRange(period: string): { from: string; to: string } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  switch (period) {
    case 'today':
      return { from: todayStr, to: todayStr };
    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return { from: yesterdayStr, to: yesterdayStr };
    
    case 'this_week':
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return { 
        from: startOfWeek.toISOString().split('T')[0], 
        to: endOfWeek.toISOString().split('T')[0] 
      };
    
    case 'last_week':
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      return { 
        from: lastWeekStart.toISOString().split('T')[0], 
        to: lastWeekEnd.toISOString().split('T')[0] 
      };
    
    case 'this_month':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { 
        from: startOfMonth.toISOString().split('T')[0], 
        to: endOfMonth.toISOString().split('T')[0] 
      };
    
    default:
      return { from: todayStr, to: todayStr };
  }
}
