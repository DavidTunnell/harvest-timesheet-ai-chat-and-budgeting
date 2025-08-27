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

export function generateProjectReportHTML(regularProjects: any[], bhsProjects: any[] = [], reportDate?: string): string {
  const currentDate = reportDate || new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long' 
  });

  // Generate regular projects table
  let regularTableRows = '';
  let totalRegularHours = 0;
  let totalRegularBudget = 0;

  regularProjects.forEach(project => {
    const budgetPercentage = project.budget > 0 
      ? ((project.billedAmount || 0) / project.budget * 100).toFixed(1)
      : 'N/A';
    
    totalRegularHours += project.totalHours;
    totalRegularBudget += project.billedAmount || 0;

    // Apply color coding: Green (<85%), Yellow (85-100%), Red (>100%)
    const percentage = parseFloat(budgetPercentage);
    let bgColor = '#d4edda'; // Green background
    if (percentage >= 85 && percentage <= 100) bgColor = '#fff3cd'; // Yellow background
    if (percentage > 100) bgColor = '#f8d7da'; // Red background

    regularTableRows += `
      <tr style="background-color: ${bgColor};">
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${project.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${project.totalHours.toFixed(1)}h</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${project.billableHours ? project.billableHours.toFixed(1) + 'h' : '0h'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${project.budget > 0 ? `$${project.budget.toLocaleString()}` : 'No Budget Set'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">
          ${budgetPercentage}%
        </td>
      </tr>
    `;
  });

  // Generate BHS projects table with client-specific structure
  let bhsTableRows = '';
  let totalBhsHours = 0;
  let totalBhsSupportHours = 0;
  let totalBhsBudget = 0;

  // BHS projects should show: Client Name, Hours Logged, Support Hours, Budget %, Total Budget
  bhsProjects.forEach(project => {
    // Extract client name from project name (remove " - Basic Hosting Support" suffix)
    const clientName = project.name.replace(/ - Basic Hosting Support$/, '');
    
    // Use the actual support hours from the project data (budget field represents support hours)
    const supportHours = project.budget;
    const budgetPercentage = supportHours > 0 
      ? ((project.totalHours / supportHours) * 100).toFixed(1)
      : '0.0';
    const totalBudget = supportHours * 150; // $150 per support hour
    
    totalBhsHours += project.totalHours;
    totalBhsSupportHours += supportHours;
    totalBhsBudget += totalBudget;

    // Apply color coding: Green (<85%), Yellow (85-100%), Red (>100%)
    const percentage = parseFloat(budgetPercentage);
    let bgColor = '#d4edda'; // Green background
    if (percentage >= 85 && percentage <= 100) bgColor = '#fff3cd'; // Yellow background
    if (percentage > 100) bgColor = '#f8d7da'; // Red background

    bhsTableRows += `
      <tr style="background-color: ${bgColor};">
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${clientName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${project.totalHours.toFixed(1)}h</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${supportHours}h</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">
          ${budgetPercentage}%
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">$${totalBudget.toLocaleString()}</td>
      </tr>
    `;
  });

  const bhsSection = bhsProjects.length > 0 ? `
    <div style="margin-top: 40px;">
      <h2 style="color: #2c3e50; margin-bottom: 20px;">Basic Hosting Support (BHS) Projects</h2>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: #374151; color: white;">
            <th style="padding: 15px; text-align: left;">Client Name</th>
            <th style="padding: 15px; text-align: center;">Hours Logged</th>
            <th style="padding: 15px; text-align: center;">Support Hours</th>
            <th style="padding: 15px; text-align: center;">Budget %</th>
            <th style="padding: 15px; text-align: center;">Total Budget</th>
          </tr>
        </thead>
        <tbody>
          ${bhsTableRows}
        </tbody>
      </table>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Monthly Project Budget Report</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Monthly Project Budget Report</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${currentDate}</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h2 style="color: #2c3e50; margin-top: 0;">Monthly Summary</h2>
        <p>This report shows the total hours and budget utilization for each project for the selected month.</p>
      </div>

      <h2 style="color: #2c3e50; margin-bottom: 20px;">Primary Projects</h2>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: #374151; color: white;">
            <th style="padding: 15px; text-align: left;">Project Name</th>
            <th style="padding: 15px; text-align: center;">Hours Logged</th>
            <th style="padding: 15px; text-align: center;">Billable Hours</th>
            <th style="padding: 15px; text-align: center;">Total Budget</th>
            <th style="padding: 15px; text-align: center;">Budget %</th>
          </tr>
        </thead>
        <tbody>
          ${regularTableRows}
        </tbody>
      </table>

      ${bhsSection}

      <div style="margin-top: 30px; padding: 20px; background: #ecf0f1; border-radius: 8px;">
        <h3 style="color: #2c3e50; margin-top: 0;">Summary</h3>
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
          <div style="background: white; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">Total Hours</h4>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #FF6B35;">${(totalRegularHours + totalBhsHours).toFixed(1)}h</p>
          </div>
          <div style="background: white; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">Total Billable Hours</h4>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #27ae60;">${(regularProjects.reduce((sum, p) => sum + (p.billableHours || 0), 0) + totalBhsSupportHours).toFixed(1)}h</p>
          </div>
          <div style="background: white; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">Total Budget</h4>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #3498db;">$${(totalRegularBudget + totalBhsBudget).toLocaleString()}</p>
          </div>
        </div>
        <p style="margin-top: 20px;"><strong>Projects Tracked:</strong> ${regularProjects.length + bhsProjects.length}</p>
        <p style="font-size: 12px; color: #7f8c8d; margin-top: 20px;">
          This report is automatically generated by your Harvest Assistant every Monday at 8:00 AM CST.
        </p>
      </div>
    </body>
    </html>
  `;
}