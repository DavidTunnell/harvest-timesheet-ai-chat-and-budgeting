import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { parseNaturalLanguageQuery, generateResponse } from "./services/openai";
import { HarvestService } from "./services/harvest";
import { reportScheduler } from "./services/scheduler";
import { insertChatMessageSchema, insertHarvestConfigSchema, insertEmailConfigSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Chat endpoint for natural language queries
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get Harvest configuration
      const harvestConfig = await storage.getHarvestConfig();
      if (!harvestConfig) {
        return res.status(400).json({ 
          error: "Harvest API not configured. Please set up your API credentials first." 
        });
      }

      // Parse the natural language query with Anthropic
      const parsedQuery = await parseNaturalLanguageQuery(message);
      
      // Initialize Harvest service
      const harvestService = new HarvestService({
        accountId: harvestConfig.accountId,
        accessToken: harvestConfig.accessToken
      });

      // Execute the appropriate Harvest API call
      let harvestData: any = null;
      let summary: any = null;

      switch (parsedQuery.queryType) {
        case 'time_entries':
          harvestData = await harvestService.getTimeEntries(parsedQuery.parameters);
          summary = harvestService.generateSummary(harvestData, 'time_entries', parsedQuery.summaryType);
          break;
        case 'projects':
          harvestData = await harvestService.getProjects();
          break;
        case 'clients':
          harvestData = await harvestService.getClients();
          break;
        case 'summary':
          harvestData = await harvestService.getTimeEntries(parsedQuery.parameters);
          summary = harvestService.generateSummary(harvestData, 'time_entries', parsedQuery.summaryType);
          break;
        default:
          harvestData = await harvestService.getTimeEntries(parsedQuery.parameters);
      }

      // Generate AI response
      const aiResponse = await generateResponse(message, harvestData, parsedQuery.queryType);

      // Store the conversation
      await storage.createChatMessage({
        content: message,
        role: 'user',
        harvestData: null,
        queryType: parsedQuery.queryType
      });

      await storage.createChatMessage({
        content: aiResponse,
        role: 'assistant',
        harvestData: { data: harvestData, summary, parsedQuery },
        queryType: parsedQuery.queryType
      });

      res.json({
        response: aiResponse,
        data: harvestData,
        summary,
        queryType: parsedQuery.queryType,
        parsedQuery
      });

    } catch (error) {
      console.error("Chat API error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "An unexpected error occurred" 
      });
    }
  });

  // Configure Harvest API credentials
  app.post("/api/harvest/config", async (req, res) => {
    try {
      const validation = insertHarvestConfigSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid configuration data", details: validation.error });
      }

      const { accountId, accessToken } = validation.data;

      // Test the connection before saving
      const harvestService = new HarvestService({ accountId, accessToken });
      const isValid = await harvestService.testConnection();

      if (!isValid) {
        return res.status(400).json({ error: "Invalid Harvest API credentials" });
      }

      await storage.saveHarvestConfig({ accountId, accessToken });
      res.json({ success: true, message: "Harvest API configured successfully" });

    } catch (error) {
      console.error("Harvest config error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to configure Harvest API" 
      });
    }
  });

  // Get Harvest connection status
  app.get("/api/harvest/status", async (req, res) => {
    try {
      const config = await storage.getHarvestConfig();
      if (!config) {
        return res.json({ connected: false, message: "No configuration found" });
      }

      const harvestService = new HarvestService({
        accountId: config.accountId,
        accessToken: config.accessToken
      });

      const isConnected = await harvestService.testConnection();
      res.json({ 
        connected: isConnected, 
        message: isConnected ? "Connected to Harvest API" : "Connection failed" 
      });

    } catch (error) {
      console.error("Harvest status error:", error);
      res.json({ connected: false, message: "Error checking connection" });
    }
  });

  // Get chat history
  app.get("/api/chat/history", async (req, res) => {
    try {
      const messages = await storage.getChatMessages();
      res.json(messages);
    } catch (error) {
      console.error("Chat history error:", error);
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  // Manual trigger for weekly report (for testing)
  app.post("/api/reports/trigger", async (req, res) => {
    try {
      await reportScheduler.triggerManualReport();
      res.json({ success: true, message: "Weekly report triggered successfully" });
    } catch (error) {
      console.error("Manual report trigger error:", error);
      res.status(500).json({ error: "Failed to trigger weekly report" });
    }
  });

  // Get current configurations
  app.get("/api/config", async (req, res) => {
    try {
      const harvestConfig = await storage.getHarvestConfig();
      const emailConfig = await storage.getEmailConfig();
      
      // For security, only return if configs exist, not the actual values
      const response = {
        harvestConfigured: !!harvestConfig,
        emailConfigured: !!emailConfig,
        harvestAccountId: harvestConfig?.accountId || "",
        emailUser: emailConfig?.emailUser || "",
        reportRecipients: emailConfig?.reportRecipients || ""
      };
      
      res.json(response);
    } catch (error) {
      console.error("Config retrieval error:", error);
      res.status(500).json({ error: "Failed to retrieve configuration" });
    }
  });

  // Configure email settings
  app.post("/api/email/config", async (req, res) => {
    try {
      // Create a partial schema for updates
      const partialEmailSchema = insertEmailConfigSchema.partial();
      const validation = partialEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid email configuration data", details: validation.error });
      }

      const { emailUser, emailPassword, reportRecipients } = validation.data;
      
      await storage.saveEmailConfig({ emailUser, emailPassword, reportRecipients });
      res.json({ success: true, message: "Email settings configured successfully" });
    } catch (error) {
      console.error("Email config error:", error);
      res.status(500).json({ error: "Failed to configure email settings" });
    }
  });

  // Get weekly report data
  app.get("/api/reports/data", async (req, res) => {
    try {
      const harvestConfig = await storage.getHarvestConfig();
      
      if (!harvestConfig) {
        return res.status(400).json({ error: "Harvest API not configured" });
      }

      const harvestService = new HarvestService({
        accountId: harvestConfig.accountId,
        accessToken: harvestConfig.accessToken
      });

      // Get month parameter or default to current month
      const monthParam = req.query.month as string;
      const selectedDate = monthParam ? new Date(monthParam + '-01') : new Date();
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1; // getMonth() returns 0-11, so add 1

      // Calculate date range for the selected month
      const startOfMonth = new Date(year, selectedDate.getMonth(), 1);
      const endOfMonth = new Date(year, selectedDate.getMonth() + 1, 0);
      
      const dateRange = {
        from: startOfMonth.toISOString().split('T')[0],
        to: endOfMonth.toISOString().split('T')[0]
      };

      console.log(`Loading report data for ${selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (${dateRange.from} to ${dateRange.to})`);

      // Get time entries for this month
      const timeEntries = await harvestService.getTimeEntries({
        dateRange,
        filters: {}
      });

      // Get all projects to get budget information
      const projects = await harvestService.getProjects();

      // Filter for only the requested projects (broader matching)
      const targetProjects = [
        { keywords: ["educational data services", "educational", "eds", "inc", "retained support services"], name: "EDS Retained Support Services" },
        { keywords: ["cloudsee", "cloud see"], name: "CloudSee Drive" },
        { keywords: ["vision", "ast"], name: "Vision AST" },
        { keywords: ["basic hosting support", "bhs", "hosting support"], name: "Basic Hosting Support (BHS)" }
      ];

      // First, find all target projects and group them by category
      const categoryMap = new Map();
      let totalHours = 0;

      // Initialize target categories
      targetProjects.forEach(target => {
        categoryMap.set(target.name, {
          id: target.name.toLowerCase().replace(/[^a-z]/g, ''),
          name: target.name,
          totalHours: 0,
          budget: 0,
          budgetSpent: 0,
          budgetRemaining: 0,
          billedAmount: 0,
          billableHours: 0,
          harvestProjects: [] // Track which Harvest projects belong to this category
        });
      });

      // Add all matching projects to their categories
      projects.forEach(project => {
        const matchedTarget = targetProjects.find(target => 
          target.keywords.some(keyword => 
            project.name.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        
        if (matchedTarget) {
          const categoryData = categoryMap.get(matchedTarget.name);
          categoryData.harvestProjects.push(project);
          
          // Use actual budget from Harvest API, with known budgets as fallback
          let projectBudget = project.budget || 0;
          
          // Set known budgets if Harvest API doesn't have them
          if (projectBudget === 0) {
            if (matchedTarget.name === 'EDS Retained Support Services') {
              projectBudget = 15500; // $15,500 for EDS
            } else if (matchedTarget.name === 'Vision AST') {
              projectBudget = 14700; // $14,700 for Vision AST
            }
          }
          
          categoryData.budget += projectBudget;
          categoryData.budgetSpent += project.budget_spent || 0;
          categoryData.budgetRemaining += project.budget_remaining || 0;
        }
      });

      // Now add time entry hours to categories
      timeEntries.forEach(entry => {
        const projectId = entry.project.id;
        const projectName = entry.project.name;
        
        // Find which category this time entry belongs to
        const matchedTarget = targetProjects.find(target => 
          target.keywords.some(keyword => 
            projectName.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        
        if (matchedTarget) {
          const categoryData = categoryMap.get(matchedTarget.name);
          categoryData.totalHours += entry.hours;
          totalHours += entry.hours;
          
          // Track billable hours and billing amounts
          if (entry.billable) {
            categoryData.billableHours += entry.hours;
            categoryData.billedAmount += (entry.billable_rate || 0) * entry.hours;
          }
        }
      });

      // Convert categories to project format
      const allProjects = Array.from(categoryMap.values())
        .map(category => ({
          ...category,
          budgetUsed: category.budget > 0 
            ? Math.round((category.budgetSpent / category.budget * 100) * 100) / 100
            : 0,
          budgetPercentComplete: category.budget > 0 
            ? Math.round((category.billedAmount / category.budget * 100) * 100) / 100
            : 0,
          billedAmount: Math.round(category.billedAmount * 100) / 100,
          billableHours: Math.round(category.billableHours * 100) / 100
        }));
      
      // Get clients data to organize BHS projects properly
      const clients = await harvestService.getClients();
      const clientMap = new Map();
      clients.forEach(client => {
        clientMap.set(client.id, client);
      });

      // Process BHS projects separately using original Harvest data
      const targetBhsClients = [
        { keywords: ['atlantic', 'british'], displayName: 'Atlantic British Ltd.', supportHours: 8 },
        { keywords: ['erep'], displayName: 'eRep, Inc.', supportHours: 2 },
        { keywords: ['icon', 'media'], displayName: 'Icon Media, Inc.', supportHours: 8 },
        { keywords: ['vision'], displayName: 'Vision AST', supportHours: 1.5 }
      ];

      const bhsClientMap = new Map();

      // Initialize BHS client entries with default support hours
      targetBhsClients.forEach(client => {
        bhsClientMap.set(client.displayName, {
          id: `bhs-${client.displayName.toLowerCase().replace(/[^a-z]/g, '')}`,
          name: `${client.displayName} - Basic Hosting Support`,
          totalHours: 0,
          supportHours: client.supportHours,
          budgetPercentage: 0,
          totalBudget: client.supportHours * 150 // $150 per hour rate
        });
      });

      // Find BHS time entries and group by client
      timeEntries.forEach(entry => {
        const projectName = entry.project.name.toLowerCase();
        const isBasicHosting = projectName.includes('basic hosting support') || projectName.includes('bhs');
        
        if (isBasicHosting) {
          // Find the project to get client information
          const harvestProject = projects.find(p => p.id === entry.project.id);
          if (harvestProject && harvestProject.client) {
            const clientName = harvestProject.client.name.toLowerCase();
            
            // Match to target BHS clients
            const matchedClient = targetBhsClients.find(target =>
              target.keywords.some(keyword => clientName.includes(keyword))
            );
            
            if (matchedClient) {
              const clientEntry = bhsClientMap.get(matchedClient.displayName);
              clientEntry.totalHours += entry.hours;
              
              // Calculate budget percentage (hours logged / support hours * 100)
              clientEntry.budgetPercentage = clientEntry.supportHours > 0 
                ? Math.round((clientEntry.totalHours / clientEntry.supportHours * 100) * 100) / 100
                : 0;
            }
          }
        }
      });

      const bhsProjects = Array.from(bhsClientMap.values()).sort((a, b) => b.totalHours - a.totalHours);
      
      const regularProjects = allProjects.filter(project => 
        !project.name.toLowerCase().includes('basic hosting support') && 
        !project.name.toLowerCase().includes('bhs')
      );
      
      const projectData = regularProjects.sort((a, b) => b.totalHours - a.totalHours);

      // Calculate total BHS hours for summary
      const totalBhsHours = bhsProjects.reduce((sum, project) => sum + project.totalHours, 0);

      res.json({
        projects: projectData,
        bhsProjects: bhsProjects,
        summary: {
          totalHours: totalHours + totalBhsHours,
          projectCount: projectData.length,
          reportDate: selectedDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long' 
          })
        }
      });

    } catch (error) {
      console.error("Report data error:", error);
      res.status(500).json({ error: "Failed to fetch report data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
