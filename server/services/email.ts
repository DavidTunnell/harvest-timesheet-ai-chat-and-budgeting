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
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${project.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${project.totalHours.toFixed(1)}h</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">$${project.budget.toLocaleString()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${budgetColor}; font-weight: 600;">
          ${project.budgetPercentComplete.toFixed(1)}%
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${project.billableHours.toFixed(1)}h</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">$${project.billedAmount.toFixed(2)}</td>
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
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${clientName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${project.totalHours.toFixed(1)}h</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${supportHours}h</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${budgetColor}; font-weight: 600;">
          ${budgetPercentage.toFixed(1)}%
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">$${project.budget.toLocaleString()}</td>
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .summary-card { 
          display: inline-block; 
          background: white; 
          border-radius: 8px; 
          padding: 20px; 
          margin: 10px; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          min-width: 200px;
        }
        .summary-card h3 { margin: 0 0 10px 0; color: #374151; font-size: 14px; font-weight: 500; }
        .summary-card .value { font-size: 24px; font-weight: 700; color: #111827; }
      </style>
    </head>
    <body style="background-color: white; margin: 0; padding: 40px; color: #111827;">
      <div style="max-width: 1200px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #111827; font-size: 32px; font-weight: 700; margin: 0 0 8px 0;">
            Monthly Project Budget Report
          </h1>
          <p style="color: #6b7280; font-size: 18px; margin: 0;">
            ${summary?.reportDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </p>
        </div>

        <!-- Summary Cards -->
        <div style="text-align: center; margin-bottom: 40px;">
          <div class="summary-card">
            <h3>Total Hours</h3>
            <div class="value">${summary?.totalHours?.toFixed(1) || '0.0'}h</div>
          </div>
          <div class="summary-card">
            <h3>Total Budget</h3>
            <div class="value">$${(totalPrimaryBudget + totalBhsBudget).toLocaleString()}</div>
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
        <div style="margin-bottom: 40px;">
          <h2 style="color: #374151; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Primary Projects</h2>
          <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #1f2937; color: white;">
                  <th style="padding: 16px; text-align: left; font-weight: 600;">Project Name</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Hours Logged</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Budget</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Budget %</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Billable Hours</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Billed Amount</th>
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
        <div style="margin-bottom: 40px;">
          <h2 style="color: #374151; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Basic Hosting Support (BHS) Projects</h2>
          <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #1f2937; color: white;">
                  <th style="padding: 16px; text-align: left; font-weight: 600;">Client Name</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Hours Logged</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Support Hours</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Budget %</th>
                  <th style="padding: 16px; text-align: center; font-weight: 600;">Total Budget</th>
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