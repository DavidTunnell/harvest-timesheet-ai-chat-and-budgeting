import cron from 'node-cron';
import { HarvestService } from './harvest';
import { sendEmail } from './email';
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

      // Create simple email with link to report page
      const reportUrl = `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'http://localhost:5000'}/report`;
      
      const emailContent = `
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ea580c, #fb923c); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
              <h1 style="margin: 0 0 10px 0; font-size: 28px;">Weekly Project Budget Report</h1>
              <p style="margin: 0; color: #fed7aa;">Ready for your review</p>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; text-align: center;">
              <h2 style="color: #374151; margin-bottom: 15px;">Your ${new Date().toLocaleDateString('en-US', { month: 'long' })} project budget report is ready!</h2>
              <p style="color: #6b7280; margin-bottom: 25px;">Click the button below to view your detailed project budget report with current data from Harvest.</p>
              
              <a href="${reportUrl}" style="display: inline-block; background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-bottom: 20px;">
                View Report →
              </a>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-top: 20px;">
                <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 16px;">What's included:</h3>
                <ul style="color: #6b7280; text-align: left; margin: 0; padding-left: 20px;">
                  <li>Primary Projects with budget tracking</li>
                  <li>Basic Hosting Support (BHS) client breakdown</li>
                  <li>Monthly summary totals and metrics</li>
                  <li>Historical data with month selection</li>
                </ul>
              </div>
            </div>
            
            <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
              <p>This reminder is sent every Monday at 8:00 AM CST.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Split recipients by comma and send to each
      const recipients = emailConfig.reportRecipients.split(',').map(email => email.trim());
      let anySuccess = false;
      
      for (const recipient of recipients) {
        if (recipient) {
          console.log(`Sending weekly report link to ${recipient}`);
          const emailSuccess = await sendEmail({
            to: recipient,
            subject: `Weekly Project Budget Report - Ready for Review`,
            html: emailContent
          });

          if (emailSuccess) {
            console.log(`Weekly report link sent successfully to ${recipient}`);
            anySuccess = true;
          } else {
            console.log(`Failed to send weekly report link to ${recipient}`);
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