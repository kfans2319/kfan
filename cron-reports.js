#!/usr/bin/env node
/**
 * User Signup Reports Cron Job
 * 
 * This script is designed to be scheduled via cron to generate automated reports.
 * It can generate daily, weekly, or monthly reports and optionally send email notifications.
 * 
 * Usage:
 *   node cron-reports.js [type] [notify]
 * 
 * Arguments:
 *   type: The type of report to generate (daily, weekly, monthly, or all). Default: daily
 *   notify: Whether to send email notifications (true or false). Default: false
 * 
 * Example crontab entries:
 *   # Daily report at midnight
 *   0 0 * * * cd /path/to/app && node cron-reports.js daily true
 *   
 *   # Weekly report on Sundays
 *   0 0 * * 0 cd /path/to/app && node cron-reports.js weekly true
 *   
 *   # Monthly report on the 1st of each month
 *   0 0 1 * * cd /path/to/app && node cron-reports.js monthly true
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const reportType = (args[0] || 'daily').toLowerCase();
const shouldNotify = args[1] === 'true';

// Load nodemailer only if notifications are enabled (optional dependency)
let nodemailer;
if (shouldNotify) {
  try {
    nodemailer = require('nodemailer');
  } catch (error) {
    console.warn('Nodemailer not installed. Email notifications will be disabled.');
    console.warn('Install with: npm install nodemailer');
  }
}

// Configuration
const config = {
  outputDir: path.join(process.cwd(), 'reports'),
  emailConfig: {
    enabled: shouldNotify && nodemailer,
    from: process.env.EMAIL_FROM || 'noreply@kinkyfan.org',
    to: process.env.EMAIL_TO || 'admin@kinkyfan.org',
    subject: 'KinkyFan User Signup Report',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    }
  }
};

/**
 * Generate daily reports
 */
async function generateDailyReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Count users who signed up today
  const userCount = await prisma.user.count({
    where: {
      createdAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });
  
  // Count total users
  const totalUsers = await prisma.user.count();
  
  // Get recent users
  const recentUsers = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: today
      }
    },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      isVerified: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });
  
  // Create report
  const report = {
    date: today.toISOString(),
    newUsers: userCount,
    totalUsers,
    recentUsers: recentUsers.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      signupTime: user.createdAt,
      verified: user.isVerified
    }))
  };
  
  // Save report
  const filename = `daily-report-${today.toISOString().split('T')[0]}.json`;
  const filePath = path.join(config.outputDir, filename);
  
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  
  console.log(`Daily report generated: ${filePath}`);
  console.log(`New users today: ${userCount}`);
  
  return { report, filePath };
}

/**
 * Generate weekly report by running the user-analytics script
 */
async function generateWeeklyReport() {
  try {
    const output = execSync('node user-analytics.js week 20').toString();
    console.log('Weekly report generated via user-analytics.js');
    console.log(output);
    return { output };
  } catch (error) {
    console.error('Error generating weekly report:', error);
    throw error;
  }
}

/**
 * Generate monthly report by running the monthly-report script
 */
async function generateMonthlyReport() {
  try {
    const output = execSync('node generate-monthly-report.js').toString();
    console.log('Monthly report generated via generate-monthly-report.js');
    console.log(output);
    
    // Get the path to the generated report file
    const now = new Date();
    const filename = `user-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.json`;
    const filePath = path.join(config.outputDir, filename);
    
    return { output, filePath };
  } catch (error) {
    console.error('Error generating monthly report:', error);
    throw error;
  }
}

/**
 * Send email notification with report
 */
async function sendEmailNotification(subject, text, attachments = []) {
  if (!config.emailConfig.enabled || !nodemailer) {
    console.log('Email notifications disabled or nodemailer not installed');
    return;
  }
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransport(config.emailConfig.smtp);
    
    // Send email
    const info = await transporter.sendMail({
      from: config.emailConfig.from,
      to: config.emailConfig.to,
      subject,
      text,
      attachments
    });
    
    console.log(`Email notification sent: ${info.messageId}`);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

/**
 * Main function to run the appropriate reports
 */
async function run() {
  try {
    console.log(`Running ${reportType} report at ${new Date().toISOString()}`);
    
    let report = null;
    let emailSubject = '';
    let emailText = '';
    let attachments = [];
    
    switch (reportType) {
      case 'daily':
        const dailyResult = await generateDailyReport();
        report = dailyResult.report;
        emailSubject = `Daily User Report - ${new Date().toISOString().split('T')[0]}`;
        emailText = `Daily user signup report for ${new Date().toISOString().split('T')[0]}:\n\n` +
                   `New users: ${report.newUsers}\n` +
                   `Total users: ${report.totalUsers}\n\n` +
                   `See attached JSON file for details.`;
        attachments = [{ path: dailyResult.filePath }];
        break;
        
      case 'weekly':
        const weeklyResult = await generateWeeklyReport();
        emailSubject = `Weekly User Report - ${new Date().toISOString().split('T')[0]}`;
        emailText = `Weekly user signup report:\n\n${weeklyResult.output}`;
        break;
        
      case 'monthly':
        const monthlyResult = await generateMonthlyReport();
        emailSubject = `Monthly User Report - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`;
        emailText = `Monthly user signup report:\n\n${monthlyResult.output}`;
        if (monthlyResult.filePath) {
          attachments = [{ path: monthlyResult.filePath }];
        }
        break;
        
      case 'all':
        await generateDailyReport();
        await generateWeeklyReport();
        await generateMonthlyReport();
        emailSubject = `All User Reports - ${new Date().toISOString().split('T')[0]}`;
        emailText = `All user signup reports have been generated. Check the reports directory for details.`;
        break;
        
      default:
        console.error(`Unknown report type: ${reportType}`);
        process.exit(1);
    }
    
    // Send email notification if enabled
    if (shouldNotify && emailSubject) {
      await sendEmailNotification(emailSubject, emailText, attachments);
    }
    
    console.log('Report generation completed successfully');
  } catch (error) {
    console.error('Error generating reports:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
run(); 