// Fallback email service that works without Gmail authentication
// This creates a local HTML file as a backup when email fails

import { writeFileSync } from 'fs';
import { join } from 'path';

export async function saveReportAsFile(htmlContent: string, recipient: string): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `weekly-report-${timestamp}.html`;
    const filepath = join(process.cwd(), 'reports', filename);
    
    // Create reports directory if it doesn't exist
    const { mkdirSync } = await import('fs');
    try {
      mkdirSync(join(process.cwd(), 'reports'), { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
    
    writeFileSync(filepath, htmlContent);
    
    console.log(`
📧 Email Report Generated!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Since email delivery had issues, your weekly report has been 
saved as an HTML file that you can manually send:

📄 File Location: ${filepath}
📫 Intended Recipient: ${recipient}
🌐 Open this file in your browser to view the report

You can manually email this file or copy the HTML content
to send via your preferred email client.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
    
    return true;
  } catch (error) {
    console.error('Failed to save report file:', error);
    return false;
  }
}

export function createEmailInstructions(recipient: string): string {
  return `
📧 MANUAL EMAIL INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To manually send the weekly report:

1. Open the HTML file saved in the reports/ folder
2. Copy all the content (Ctrl+A, Ctrl+C)
3. Open your email client (Gmail, Outlook, etc.)
4. Create a new email to: ${recipient}
5. Subject: Weekly Project Budget Report - [Current Month]
6. Paste the HTML content into the email body
7. Send the email

The report contains:
• Month-to-date project hours
• Budget utilization percentages  
• Professional formatting with tables and styling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `;
}