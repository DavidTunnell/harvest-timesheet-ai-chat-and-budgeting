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

      // Group projects by target display name to avoid duplicates
      const projectGroupMap = new Map();
      let totalHours = 0;

      // Initialize target project groups
      targetProjects.forEach(target => {
        if (target.name !== "Basic Hosting Support (BHS)") { // Skip BHS as it's handled separately
          projectGroupMap.set(target.name, {
            id: target.name.toLowerCase().replace(/[^a-z]/g, ''),
            name: target.name,
            totalHours: 0,
            budget: 0,
            budgetSpent: 0,
            budgetRemaining: 0,
            billedAmount: 0,
            billableHours: 0,
            matchingProjectIds: []
          });
        }
      });

      // Find all matching projects and consolidate their data
      projects.forEach(project => {
        const matchingTarget = targetProjects.find(target => 
          target.keywords.some(keyword => 
            project.name.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        
        if (matchingTarget && matchingTarget.name !== "Basic Hosting Support (BHS)") {
          const groupData = projectGroupMap.get(matchingTarget.name);
          
          // Use actual budget from Harvest API, with known budgets as fallback
          let projectBudget = project.budget || 0;
          
          // Set known budgets if Harvest API doesn't have them
          if (projectBudget === 0) {
            if (matchingTarget.name === "EDS Retained Support Services") {
              projectBudget = 15500; // $15,500 for EDS
            } else if (matchingTarget.name === "Vision AST") {
              projectBudget = 14700; // $14,700 for Vision AST
            }
          }
          
          // Aggregate budget data (use the highest budget found)
          if (projectBudget > groupData.budget) {
            groupData.budget = projectBudget;
          }
          groupData.budgetSpent += project.budget_spent || 0;
          groupData.budgetRemaining += project.budget_remaining || 0;
          groupData.matchingProjectIds.push(project.id);
        }
      });

      // Now add time entry hours to the grouped projects
      timeEntries.forEach(entry => {
        const projectId = entry.project.id;
        const projectName = entry.project.name;
        
        // Find which target group this project belongs to
        const matchingTarget = targetProjects.find(target => 
          target.keywords.some(keyword => 
            projectName.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        
        if (matchingTarget && matchingTarget.name !== "Basic Hosting Support (BHS)") {
          const groupData = projectGroupMap.get(matchingTarget.name);
          
          // Only add hours if this project ID is in our matching list (to avoid double counting)
          if (groupData.matchingProjectIds.includes(projectId)) {
            groupData.totalHours += entry.hours;
            totalHours += entry.hours;
            
            // Track billable hours
            if (entry.billable) {
              groupData.billableHours += entry.hours;
            }
          }
        }
      });

      const allProjects = Array.from(projectGroupMap.values())
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
      const clients = await harvestService.getClients();
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

      res.json({
        projects: projectData,
        bhsProjects: bhsProjects.sort((a, b) => b.totalHours - a.totalHours),
        summary: {
          totalHours: totalHours,
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
