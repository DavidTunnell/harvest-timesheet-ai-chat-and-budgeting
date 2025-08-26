import cron from 'node-cron';
import { HarvestService } from './harvest';
import { sendEmail, generateProjectReportHTML } from './email';
import { saveReportAsFile, createEmailInstructions } from './email-fallback';
import { storage } from '../storage';

interface ProjectReportData {
  name: string;
  totalHours: number;
  budget: number;
  avgHourlyRate: number;
}

export class ReportScheduler {
  private harvestService: HarvestService | null = null;

  constructor() {
    this.initializeHarvestService();
  }

  private async initializeHarvestService() {
    try {
      const harvestConfig = await storage.getHarvestConfig();
      if (harvestConfig) {
        this.harvestService = new HarvestService({
          accountId: harvestConfig.accountId,
          accessToken: harvestConfig.accessToken
        });
        console.log('Harvest service initialized for scheduled reports');
      } else {
        console.log('No Harvest configuration found - scheduled reports disabled');
      }
    } catch (error) {
      console.error('Failed to initialize Harvest service for scheduling:', error);
    }
  }

  private getMonthDateRange(): { from: string; to: string } {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      from: startOfMonth.toISOString().split('T')[0],
      to: endOfMonth.toISOString().split('T')[0]
    };
  }

  private async generateProjectReport(): Promise<ProjectReportData[]> {
    if (!this.harvestService) {
      throw new Error('Harvest service not initialized');
    }

    const dateRange = this.getMonthDateRange();
    
    // Get time entries for this month
    const timeEntries = await this.harvestService.getTimeEntries({
      dateRange,
      filters: {}
    });

    // Get all projects to get budget information
    const projects = await this.harvestService.getProjects();

    // Group time entries by project and calculate totals
    const projectMap = new Map<number, ProjectReportData>();

    timeEntries.forEach(entry => {
      const projectId = entry.project.id;
      const project = projects.find(p => p.id === projectId);
      
      if (!project) return;

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          name: project.name,
          totalHours: 0,
          budget: project.budget || 0,
          avgHourlyRate: 75 // Default hourly rate - you can make this configurable
        });
      }

      const projectData = projectMap.get(projectId)!;
      projectData.totalHours += entry.hours;
    });

    return Array.from(projectMap.values())
      .filter(project => project.totalHours > 0)
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  private async sendWeeklyReport() {
    try {
      console.log('Generating weekly project budget report...');
      
      if (!this.harvestService) {
        await this.initializeHarvestService();
        if (!this.harvestService) {
          console.log('Cannot send report - Harvest not configured');
          return;
        }
      }

      const projectData = await this.generateProjectReport();
      const htmlContent = generateProjectReportHTML(projectData);

      const emailSuccess = await sendEmail({
        to: 'david@webapper.com',
        subject: `Weekly Project Budget Report - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        html: htmlContent
      });

      if (emailSuccess) {
        console.log('Weekly report sent successfully to david@webapper.com');
      } else {
        console.log('Email delivery failed, creating backup file...');
        
        // Fallback: Save as HTML file
        const fileSuccess = await saveReportAsFile(htmlContent, 'david@webapper.com');
        
        if (fileSuccess) {
          console.log(createEmailInstructions('david@webapper.com'));
        } else {
          console.error('Failed to send weekly report via email or save as file');
        }
      }
    } catch (error) {
      console.error('Error generating/sending weekly report:', error);
    }
  }

  public startScheduler() {
    // Schedule for every Monday at 8:00 AM CST (14:00 UTC)
    // Cron format: second minute hour day month dayOfWeek
    const schedule = '0 0 14 * * 1'; // Every Monday at 14:00 UTC (8:00 AM CST)
    
    cron.schedule(schedule, () => {
      console.log('Running scheduled weekly project report...');
      this.sendWeeklyReport();
    }, {
      scheduled: true,
      timezone: "America/Chicago" // CST timezone
    });

    console.log('Weekly report scheduler started - reports will be sent every Monday at 8:00 AM CST');
    
    // For testing: also allow manual trigger every minute (comment out in production)
    // cron.schedule('0 * * * * *', () => {
    //   console.log('Manual test trigger - sending report...');
    //   this.sendWeeklyReport();
    // });
  }

  // Method to manually trigger a report (for testing)
  public async triggerManualReport() {
    console.log('Manually triggering weekly report...');
    await this.sendWeeklyReport();
  }
}

export const reportScheduler = new ReportScheduler();