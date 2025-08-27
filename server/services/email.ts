import nodemailer from 'nodemailer';
import { storage } from '../storage';

// Create a transporter using Gmail SMTP (free)
// You can use any email provider's SMTP settings
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Check if email credentials are configured
    const emailConfig = await storage.getEmailConfig();
    if (!emailConfig) {
      console.error('Email credentials not configured. Please set email credentials in settings.');
      return false;
    }

    console.log(`Attempting to send email from ${emailConfig.emailUser} to ${options.to}`);
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: emailConfig.emailUser,
        pass: emailConfig.emailPassword
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Verify the transporter configuration
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    
    const mailOptions = {
      from: options.from || emailConfig.emailUser,
      to: options.to,
      subject: options.subject,
      html: options.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${options.to}, Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    
    // Provide specific guidance based on error type
    if (error.code === 'EAUTH') {
      console.error(`
Gmail Authentication Failed. Please ensure:
1. 2-Step Verification is enabled on your Gmail account
2. You're using an App Password (not your regular Gmail password)
3. Generate App Password at: https://myaccount.google.com/apppasswords
4. Use the 16-character app password in the settings
      `);
    }
    
    return false;
  }
}

export function generateProjectReportHTML(reportData: any): string {
  const { projects, bhsProjects = [], summary } = reportData;
  
  // Generate Primary Projects table rows
  let primaryTableRows = '';
  projects.forEach(project => {
    const budgetColor = project.budgetPercentComplete > 100 ? '#ef4444' : 
                       project.budgetPercentComplete >= 85 ? '#f59e0b' : '#22c55e';
    
    primaryTableRows += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 16px 12px; text-align: left;">${project.name}</td>
        <td style="padding: 16px 12px; text-align: center;">${project.totalHours.toFixed(1)}h</td>
        <td style="padding: 16px 12px; text-align: center;">$${project.budget.toLocaleString()}</td>
        <td style="padding: 16px 12px; text-align: center; color: ${budgetColor}; font-weight: 600;">
          ${project.budgetPercentComplete.toFixed(1)}%
        </td>
        <td style="padding: 16px 12px; text-align: center;">${project.billableHours.toFixed(1)}h</td>
        <td style="padding: 16px 12px; text-align: center;">$${project.billedAmount.toFixed(2)}</td>
      </tr>
    `;
  });

  // Generate BHS Projects table rows
  let bhsTableRows = '';
  let totalBhsHours = 0;
  let totalBhsBudget = 0;
  
  bhsProjects.forEach(project => {
    const supportHours = Math.round(project.budget / 150); // Calculate support hours from budget
    const budgetPercentage = supportHours > 0 ? (project.totalHours / supportHours * 100) : 0;
    const budgetColor = budgetPercentage > 100 ? '#ef4444' : 
                       budgetPercentage >= 85 ? '#f59e0b' : '#22c55e';
    
    // Extract client name from project name
    const clientName = project.name.replace(' - Basic Hosting Support', '');
    
    totalBhsHours += project.totalHours;
    totalBhsBudget += project.budget;
    
    bhsTableRows += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 16px 12px; text-align: left;">${clientName}</td>
        <td style="padding: 16px 12px; text-align: center;">${project.totalHours.toFixed(1)}h</td>
        <td style="padding: 16px 12px; text-align: center;">${supportHours}h</td>
        <td style="padding: 16px 12px; text-align: center; color: ${budgetColor}; font-weight: 600;">
          ${budgetPercentage.toFixed(1)}%
        </td>
        <td style="padding: 16px 12px; text-align: center;">$${project.budget.toLocaleString()}</td>
      </tr>
    `;
  });

  // Calculate totals
  const totalPrimaryBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalPrimaryBilled = projects.reduce((sum, p) => sum + p.billedAmount, 0);
  const totalBillableHours = projects.reduce((sum, p) => sum + p.billableHours, 0) + totalBhsHours;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Monthly Project Budget Report</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          background-color: white; 
          margin: 0; 
          padding: 32px; 
          color: #111827;
          line-height: 1.5;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .summary-cards { 
          display: flex; 
          justify-content: center; 
          gap: 24px; 
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .summary-card { 
          background: white; 
          border-radius: 8px; 
          padding: 24px; 
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          min-width: 180px;
          text-align: center;
        }
        .summary-card h3 { 
          margin: 0 0 8px 0; 
          color: #6b7280; 
          font-size: 14px; 
          font-weight: 500; 
        }
        .summary-card .value { 
          font-size: 32px; 
          font-weight: 700; 
          color: #111827; 
          margin: 0;
        }
        .table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          margin-bottom: 32px;
        }
        .section-title {
          color: #374151;
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }
        table { width: 100%; border-collapse: collapse; }
        th { 
          background: #1f2937; 
          color: white; 
          padding: 16px 12px; 
          font-weight: 600; 
          text-align: center;
        }
        th:first-child { text-align: left; }
        td { padding: 16px 12px; border-bottom: 1px solid #e5e7eb; }
        tr:last-child td { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #111827; font-size: 32px; font-weight: 700; margin: 0 0 8px 0;">
            Monthly Project Budget Report
          </h1>
          <p style="color: #6b7280; font-size: 18px; margin: 0;">
            ${summary?.reportDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </p>
        </div>

        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="summary-card">
            <h3>Total Hours</h3>
            <div class="value">${summary?.totalHours?.toFixed(1) || '0.0'}h</div>
          </div>
          <div class="summary-card">
            <h3>Total Budget</h3>
            <div class="value">$${(totalPrimaryBudget + totalBhsBudget).toFixed(1)}</div>
          </div>
          <div class="summary-card">
            <h3>Total Billable Hours</h3>
            <div class="value">${totalBillableHours.toFixed(1)}h</div>
          </div>
          <div class="summary-card">
            <h3>Total Billed</h3>
            <div class="value">$${totalPrimaryBilled.toFixed(2)}</div>
          </div>
        </div>

        <!-- Primary Projects Table -->
        <div>
          <h2 class="section-title">Primary Projects</h2>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">Project Name</th>
                  <th>Hours Logged</th>
                  <th>Budget</th>
                  <th>Budget %</th>
                  <th>Billable Hours</th>
                  <th>Billed Amount</th>
                </tr>
              </thead>
              <tbody>
                ${primaryTableRows}
              </tbody>
            </table>
          </div>
        </div>

        ${bhsProjects.length > 0 ? `
        <!-- BHS Projects Table -->
        <div>
          <h2 class="section-title">Basic Hosting Support (BHS) Projects</h2>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">Client Name</th>
                  <th>Hours Logged</th>
                  <th>Support Hours</th>
                  <th>Budget %</th>
                  <th>Total Budget</th>
                </tr>
              </thead>
              <tbody>
                ${bhsTableRows}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px;">
          <p>This report is automatically generated by your Harvest Assistant every Monday at 8:00 AM CST.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}