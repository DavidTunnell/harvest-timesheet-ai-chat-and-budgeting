import { type User, type InsertUser, type ChatMessage, type InsertChatMessage, type HarvestConfig, type InsertHarvestConfig, type EmailConfig, type InsertEmailConfig, users, chatMessages, harvestConfig, emailConfig } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat message operations
  getChatMessages(): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Harvest configuration operations
  getHarvestConfig(): Promise<HarvestConfig | undefined>;
  saveHarvestConfig(config: InsertHarvestConfig): Promise<HarvestConfig>;
  
  // Email configuration operations
  getEmailConfig(): Promise<EmailConfig | undefined>;
  saveEmailConfig(config: InsertEmailConfig): Promise<EmailConfig>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getChatMessages(): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages).orderBy(chatMessages.timestamp);
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values({
        ...insertMessage,
        harvestData: insertMessage.harvestData ?? null,
        queryType: insertMessage.queryType ?? null
      })
      .returning();
    return message;
  }

  async getHarvestConfig(): Promise<HarvestConfig | undefined> {
    const configs = await db.select().from(harvestConfig).where(eq(harvestConfig.isActive, true)).limit(1);
    return configs[0] || undefined;
  }

  async saveHarvestConfig(config: InsertHarvestConfig): Promise<HarvestConfig> {
    // Deactivate any existing configs
    await db.update(harvestConfig).set({ isActive: false });
    
    // Insert new config
    const [newConfig] = await db
      .insert(harvestConfig)
      .values({
        ...config,
        isActive: true
      })
      .returning();
    return newConfig;
  }

  async getEmailConfig(): Promise<EmailConfig | undefined> {
    const configs = await db.select().from(emailConfig).where(eq(emailConfig.isActive, true)).limit(1);
    return configs[0] || undefined;
  }

  async saveEmailConfig(config: InsertEmailConfig): Promise<EmailConfig> {
    // Deactivate any existing configs
    await db.update(emailConfig).set({ isActive: false });
    
    // Insert new config
    const [newConfig] = await db
      .insert(emailConfig)
      .values({
        ...config,
        isActive: true
      })
      .returning();
    return newConfig;
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private chatMessages: Map<string, ChatMessage>;
  private harvestConfig: HarvestConfig | undefined;
  private emailConfig: EmailConfig | undefined;

  constructor() {
    this.users = new Map();
    this.chatMessages = new Map();
    this.harvestConfig = undefined;
    this.emailConfig = undefined;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getChatMessages(): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      harvestData: insertMessage.harvestData ?? null,
      queryType: insertMessage.queryType ?? null
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async getHarvestConfig(): Promise<HarvestConfig | undefined> {
    return this.harvestConfig;
  }

  async saveHarvestConfig(config: InsertHarvestConfig): Promise<HarvestConfig> {
    const id = randomUUID();
    const harvestConfig: HarvestConfig = {
      ...config,
      id,
      isActive: true
    };
    this.harvestConfig = harvestConfig;
    return harvestConfig;
  }

  async getEmailConfig(): Promise<EmailConfig | undefined> {
    return this.emailConfig;
  }

  async saveEmailConfig(config: InsertEmailConfig): Promise<EmailConfig> {
    const id = randomUUID();
    const emailConfig: EmailConfig = {
      ...config,
      id,
      isActive: true
    };
    this.emailConfig = emailConfig;
    return emailConfig;
  }
}

export const storage = new DatabaseStorage();
