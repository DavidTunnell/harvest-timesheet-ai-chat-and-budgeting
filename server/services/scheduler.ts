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

  private async generateReportData(): Promise<any> {
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

    // Filter for only the requested projects (broader matching)
    const targetProjects = [
      { keywords: ["educational data services", "educational", "eds", "inc", "retained support services"], name: "EDS Retained Support Services" },
      { keywords: ["cloudsee", "cloud see"], name: "CloudSee Drive" },
      { keywords: ["vision", "ast"], name: "Vision AST" },
      { keywords: ["basic hosting support", "bhs", "hosting support"], name: "Basic Hosting Support (BHS)" }
    ];

    // First, find all target projects (even if they have no time entries this month)
    const projectMap = new Map();
    let totalHours = 0;

    // Add all target projects that exist, even with 0 hours
    projects.forEach(project => {
      const isTargetProject = targetProjects.some(target => 
        target.keywords.some(keyword => 
          project.name.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      if (isTargetProject) {
        projectMap.set(project.id, {
          id: project.id,
          name: project.name,
          totalHours: 0,
          budget: project.budget || 0,
          budgetSpent: 0,
          budgetRemaining: project.budget || 0,
          billedAmount: 0,
          billableHours: 0
        });
      }
    });

    // Now add time entry data to projects that have entries this month
    timeEntries.forEach(entry => {
      const projectId = entry.project.id;
      
      if (projectMap.has(projectId)) {
        const project = projectMap.get(projectId);
        project.totalHours += entry.hours;
        totalHours += entry.hours;
        
        if (entry.billable) {
          const billedAmount = (entry.billable_rate || 75) * entry.hours;
          project.billedAmount += billedAmount;
          project.budgetSpent += billedAmount;
          project.billableHours += entry.hours;
        }
        
        project.budgetRemaining = Math.max(0, project.budget - project.budgetSpent);
      }
    });

    const allProjects = Array.from(projectMap.values())
      .map(project => ({
        ...project,
        budgetUsed: project.budget > 0 
          ? Math.round((project.budgetSpent / project.budget * 100) * 100) / 100
          : 0,
        budgetPercentComplete: project.budget > 0 
          ? Math.round((project.billedAmount / project.budget * 100) * 100) / 100
          : 0,
        billedAmount: Math.round(project.billedAmount * 100) / 100,
        billableHours: Math.round(project.billableHours * 100) / 100
      }));
    
    // Get clients data to organize BHS projects properly
    const clients = await this.harvestService.getClients();
    const clientMap = new Map();
    clients.forEach(client => {
      clientMap.set(client.id, client);
    });

    // Separate BHS projects from regular projects and group by client
    const bhsProjectsRaw = allProjects.filter(project => 
      project.name.toLowerCase().includes('basic hosting support') || 
      project.name.toLowerCase().includes('bhs')
    );

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
        budget: 0,
        budgetSpent: 0,
        budgetRemaining: 0,
        billedAmount: 0,
        billableHours: 0,
        budgetUsed: 0,
        budgetPercentComplete: 0
      });
    });

    // Process raw BHS projects and find matching clients
    bhsProjectsRaw.forEach(project => {
      // Find the client for this project
      const projectClient = projects.find(p => p.id === project.id)?.client;
      if (projectClient) {
        const clientName = projectClient.name.toLowerCase();
        
        // Match to target clients
        const matchedClient = targetBhsClients.find(target =>
          target.keywords.some(keyword => clientName.includes(keyword))
        );
        
        if (matchedClient) {
          const clientEntry = bhsClientMap.get(matchedClient.displayName);
          clientEntry.totalHours += project.totalHours;
          clientEntry.budget += project.budget;
          clientEntry.budgetSpent += project.budgetSpent;
          clientEntry.budgetRemaining += project.budgetRemaining;
          clientEntry.billedAmount += project.billedAmount;
          clientEntry.billableHours += project.billableHours;
          
          // Update budget percentage
          if (clientEntry.budget > 0) {
            clientEntry.budgetPercentComplete = Math.round((clientEntry.billedAmount / clientEntry.budget * 100) * 100) / 100;
          }
        }
      }
    });

    // Ensure Atlantic British Ltd appears even if no matching project found
    if (!bhsClientMap.has('Atlantic British Ltd.')) {
      bhsClientMap.set('Atlantic British Ltd.', {
        id: 'bhs-atlanticbritishltd',
        name: 'Atlantic British Ltd. - Basic Hosting Support',
        totalHours: 0,
        budget: 8, // Default budget hours
        budgetSpent: 0,
        budgetRemaining: 0,
        billedAmount: 0,
        billableHours: 0,
        budgetUsed: 0,
        budgetPercentComplete: 0
      });
    }

    const bhsProjects = Array.from(bhsClientMap.values()); // Show all target BHS clients, even with 0 hours
    
    const regularProjects = allProjects.filter(project => 
      !project.name.toLowerCase().includes('basic hosting support') && 
      !project.name.toLowerCase().includes('bhs')
    );
    
    const projectData = regularProjects.sort((a, b) => b.totalHours - a.totalHours);

    return {
      projects: projectData,
      bhsProjects: bhsProjects.sort((a, b) => b.totalHours - a.totalHours),
      summary: {
        totalHours: totalHours,
        projectCount: projectData.length,
        reportDate: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        })
      }
    };
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

      const emailConfig = await storage.getEmailConfig();
      if (!emailConfig || !emailConfig.reportRecipients) {
        console.log('No email configuration or recipients found - skipping weekly report');
        return;
      }

      const reportData = await this.generateReportData();
      const htmlContent = generateProjectReportHTML(reportData);

      // Split recipients by comma and send to each
      const recipients = emailConfig.reportRecipients.split(',').map(email => email.trim());
      let anySuccess = false;
      
      for (const recipient of recipients) {
        if (recipient) {
          const emailSuccess = await sendEmail({
            to: recipient,
            subject: `Weekly Project Budget Report - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
            html: htmlContent
          });

          if (emailSuccess) {
            console.log(`Weekly report sent successfully to ${recipient}`);
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
        console.error('Failed to send weekly report to any recipients');
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