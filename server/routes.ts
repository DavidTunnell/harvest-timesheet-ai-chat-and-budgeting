import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { parseNaturalLanguageQuery, generateResponse } from "./services/openai";
import { HarvestService } from "./services/harvest";
import { reportScheduler } from "./services/scheduler";
import { insertChatMessageSchema, insertHarvestConfigSchema } from "@shared/schema";
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
      
      // For security, only return if configs exist, not the actual values
      const response = {
        harvestConfigured: !!harvestConfig,
        emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
        harvestAccountId: harvestConfig?.accountId || "",
        emailUser: process.env.EMAIL_USER || ""
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
      const { emailUser, emailPassword } = req.body;
      
      if (!emailUser || !emailPassword) {
        return res.status(400).json({ error: "Email user and password are required" });
      }
      
      // Store email config in environment variables (for this session)
      process.env.EMAIL_USER = emailUser;
      process.env.EMAIL_PASSWORD = emailPassword;
      
      res.json({ success: true, message: "Email configuration saved successfully" });
    } catch (error) {
      console.error("Email config error:", error);
      res.status(500).json({ error: "Failed to save email configuration" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
