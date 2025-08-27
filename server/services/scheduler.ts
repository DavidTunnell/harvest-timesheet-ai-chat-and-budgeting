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
  billedAmount: number;
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

  private async generateProjectReport(): Promise<{ regularProjects: any[], bhsProjects: any[], reportDate: string }> {
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

    // Filter for only the requested projects (same as Weekly Report page)
    const targetProjects = [
      { keywords: ["educational data services", "educational", "eds", "inc", "retained support services"], name: "EDS Retained Support Services" },
      { keywords: ["cloudsee", "cloud see"], name: "CloudSee Drive" },
      { keywords: ["vision", "ast"], name: "Vision AST" },
      { keywords: ["basic hosting support", "bhs", "hosting support"], name: "Basic Hosting Support (BHS)" }
    ];

    // Group time entries by project and calculate totals
    const projectMap = new Map<number, ProjectReportData>();

    // First, add all target projects that exist, even with 0 hours
    projects.forEach(project => {
      const isTargetProject = targetProjects.some(target => 
        target.keywords.some(keyword => 
          project.name.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      if (isTargetProject) {
        // Use actual budget from Harvest API
        let projectBudget = project.budget || 0;
        
        projectMap.set(project.id, {
          name: project.name,
          totalHours: 0,
          budget: projectBudget,
          avgHourlyRate: 75, // Default hourly rate
          billedAmount: 0
        });
      }
    });

    // Now add time entry hours to projects that have them
    timeEntries.forEach(entry => {
      const projectId = entry.project.id;
      
      if (projectMap.has(projectId)) {
        const projectData = projectMap.get(projectId)!;
        projectData.totalHours += entry.hours;
        // Calculate billed amount using billable rate
        if (entry.billable) {
          projectData.billedAmount += (entry.billable_rate || 75) * entry.hours;
        }
      }
    });

    const allProjects = Array.from(projectMap.values())
      .filter(project => project.totalHours > 0); // Only show projects with hours
    
    // Separate BHS projects from regular projects
    const bhsProjects = allProjects.filter(project => 
      project.name.toLowerCase().includes('basic hosting support') || 
      project.name.toLowerCase().includes('bhs')
    );
    
    const regularProjects = allProjects.filter(project => 
      !project.name.toLowerCase().includes('basic hosting support') && 
      !project.name.toLowerCase().includes('bhs')
    );
    
    // Use the same logic as the report endpoint to create BHS client structure
    const clients = await this.harvestService.getClients();
    const clientMap = new Map();
    clients.forEach(client => {
      clientMap.set(client.id, client);
    });

    // Group BHS projects by client to create the 4 specific rows
    const bhsClientMap = new Map();
    const targetBhsClients = [
      { keywords: ['atlantic', 'british'], displayName: 'Atlantic British Ltd.' },
      { keywords: ['erep'], displayName: 'eRep, Inc.' },
      { keywords: ['icon', 'media'], displayName: 'Icon Media, Inc.' },
      { keywords: ['vision'], displayName: 'Vision AST' }
    ];

    // Initialize BHS client entries
    targetBhsClients.forEach(client => {
      bhsClientMap.set(client.displayName, {
        id: `bhs-${client.displayName.toLowerCase().replace(/[^a-z]/g, '')}`,
        name: `${client.displayName} - Basic Hosting Support`,
        totalHours: 0,
        budget: client.displayName === 'Atlantic British Ltd.' ? 8 : 
                client.displayName === 'eRep, Inc.' ? 2 :
                client.displayName === 'Icon Media, Inc.' ? 8 :
                1.5, // Vision AST
        budgetSpent: 0,
        budgetRemaining: 0,
        billedAmount: 0,
        billableHours: 0,
        budgetUsed: 0,
        budgetPercentComplete: 0
      });
    });

    // Process raw BHS projects and find matching clients
    bhsProjects.forEach(project => {
      // Find the project in the full projects list to get client info
      const fullProject = projects.find(p => p.name === project.name);
      if (fullProject?.client) {
        const clientName = fullProject.client.name.toLowerCase();
        
        // Match to target clients
        const matchedClient = targetBhsClients.find(target =>
          target.keywords.some(keyword => clientName.includes(keyword))
        );
        
        if (matchedClient) {
          const clientEntry = bhsClientMap.get(matchedClient.displayName);
          clientEntry.totalHours += project.totalHours;
          clientEntry.billedAmount += project.billedAmount;
          clientEntry.billableHours = clientEntry.budget; // Support hours = budget hours
        }
      }
    });

    const processedBhsProjects = Array.from(bhsClientMap.values());
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });

    return {
      regularProjects: regularProjects.sort((a, b) => b.totalHours - a.totalHours),
      bhsProjects: processedBhsProjects.sort((a, b) => b.totalHours - a.totalHours),
      reportDate: currentDate
    };
  }

  private async sendWeeklyReport() {
    try {
      console.log('Generating monthly project budget report...');
      
      if (!this.harvestService) {
        await this.initializeHarvestService();
        if (!this.harvestService) {
          console.log('Cannot send report - Harvest not configured');
          return;
        }
      }

      const emailConfig = await storage.getEmailConfig();
      if (!emailConfig || !emailConfig.reportRecipients) {
        console.log('No email configuration or recipients found - skipping monthly report');
        return;
      }

      const projectData = await this.generateProjectReport();
      const htmlContent = generateProjectReportHTML(projectData.regularProjects, projectData.bhsProjects, projectData.reportDate);

      // Split recipients by comma and send to each
      const recipients = emailConfig.reportRecipients.split(',').map(email => email.trim());
      let anySuccess = false;
      
      for (const recipient of recipients) {
        if (recipient) {
          const emailSuccess = await sendEmail({
            to: recipient,
            subject: `Monthly Project Budget Report - ${projectData.reportDate}`,
            html: htmlContent
          });

          if (emailSuccess) {
            console.log(`Monthly report sent successfully to ${recipient}`);
            anySuccess = true;
          } else {
            console.log(`Email delivery failed for ${recipient}, creating backup file...`);
            const fileSuccess = await saveReportAsFile(htmlContent, recipient);
            if (fileSuccess) {
              console.log(createEmailInstructions(recipient));
            }
          }
        }
      }
      
      if (!anySuccess && recipients.length > 0) {
        console.error('Failed to send monthly report to any recipients');
      }
    } catch (error) {
      console.error('Error generating/sending monthly report:', error);
    }
  }

  public startScheduler() {
    // Schedule for every Monday at 8:00 AM CST (14:00 UTC)
    // Cron format: second minute hour day month dayOfWeek
    const schedule = '0 0 14 * * 1'; // Every Monday at 14:00 UTC (8:00 AM CST)
    
    cron.schedule(schedule, () => {
      console.log('Running scheduled monthly project report...');
      this.sendWeeklyReport();
    }, {
      scheduled: true,
      timezone: "America/Chicago" // CST timezone
    });

    console.log('Monthly report scheduler started - reports will be sent every Monday at 8:00 AM CST');
    
    // For testing: also allow manual trigger every minute (comment out in production)
    // cron.schedule('0 * * * * *', () => {
    //   console.log('Manual test trigger - sending report...');
    //   this.sendWeeklyReport();
    // });
  }

  // Method to manually trigger a report (for testing)
  public async triggerManualReport() {
    console.log('Manually triggering monthly report...');
    await this.sendWeeklyReport();
  }
}

export const reportScheduler = new ReportScheduler();