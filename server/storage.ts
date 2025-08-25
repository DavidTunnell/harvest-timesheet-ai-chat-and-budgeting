import { type User, type InsertUser, type ChatMessage, type InsertChatMessage, type HarvestConfig, type InsertHarvestConfig } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private chatMessages: Map<string, ChatMessage>;
  private harvestConfig: HarvestConfig | undefined;

  constructor() {
    this.users = new Map();
    this.chatMessages = new Map();
    this.harvestConfig = undefined;
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
}

export const storage = new MemStorage();
