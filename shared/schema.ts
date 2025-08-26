import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  harvestData: json("harvest_data"),
  queryType: text("query_type"),
});

export const harvestConfig = pgTable("harvest_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: text("account_id").notNull(),
  accessToken: text("access_token").notNull(),
  isActive: boolean("is_active").default(true),
});

export const emailConfig = pgTable("email_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailUser: text("email_user").notNull(),
  emailPassword: text("email_password").notNull(),
  reportRecipients: text("report_recipients").notNull().default("david@webapper.com"),
  isActive: boolean("is_active").default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  content: true,
  role: true,
  harvestData: true,
  queryType: true,
});

export const insertHarvestConfigSchema = createInsertSchema(harvestConfig).pick({
  accountId: true,
  accessToken: true,
});

export const insertEmailConfigSchema = createInsertSchema(emailConfig).pick({
  emailUser: true,
  emailPassword: true,
  reportRecipients: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type HarvestConfig = typeof harvestConfig.$inferSelect;
export type InsertHarvestConfig = z.infer<typeof insertHarvestConfigSchema>;
export type EmailConfig = typeof emailConfig.$inferSelect;
export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;

// API Response Types
export interface HarvestTimeEntry {
  id: number;
  spent_date: string;
  hours: number;
  notes: string;
  billable: boolean;
  user: {
    id: number;
    name: string;
  };
  client: {
    id: number;
    name: string;
  };
  project: {
    id: number;
    name: string;
  };
  task: {
    id: number;
    name: string;
  };
}

export interface HarvestProject {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  budget: number;
  budget_spent?: number;
  budget_remaining?: number;
  client: {
    id: number;
    name: string;
  };
}

export interface HarvestClient {
  id: number;
  name: string;
  is_active: boolean;
  address: string;
}

export interface ParsedQuery {
  queryType: 'time_entries' | 'projects' | 'clients' | 'users' | 'summary';
  parameters: {
    dateRange?: {
      from?: string;
      to?: string;
    };
    userId?: number;
    projectId?: number;
    clientId?: number;
    filters?: Record<string, any>;
  };
  summaryType?: 'weekly' | 'monthly' | 'daily' | 'project' | 'client';
}
