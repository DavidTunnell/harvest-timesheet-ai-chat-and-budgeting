import OpenAI from "openai";
import { ParsedQuery } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_SECRET_KEY || ""
});

export async function parseNaturalLanguageQuery(query: string): Promise<ParsedQuery> {
  try {
    const prompt = `
You are a Harvest API query parser. Convert the natural language query into a structured format for Harvest API calls.

Current date context: ${new Date().toISOString().split('T')[0]}

Natural language query: "${query}"

Analyze the query and determine:
1. What type of data is being requested (time_entries, projects, clients, users, summary)
2. Any date ranges (this week, last month, yesterday, specific dates)
3. Filters (user, project, client, billable status)
4. Summary type if applicable

Respond with JSON in this exact format:
{
  "queryType": "time_entries|projects|clients|users|summary",
  "parameters": {
    "dateRange": {
      "from": "YYYY-MM-DD or null",
      "to": "YYYY-MM-DD or null"
    },
    "userId": "number or null",
    "projectId": "number or null", 
    "clientId": "number or null",
    "filters": {}
  },
  "summaryType": "weekly|monthly|daily|project|client or null"
}

Examples:
- "Show me my time entries for this week" -> queryType: "time_entries", dateRange with this week's dates
- "What projects am I working on?" -> queryType: "projects", no date range
- "How many hours did I log yesterday?" -> queryType: "summary", summaryType: "daily", dateRange with yesterday's date
- "Show all clients" -> queryType: "clients", no filters
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a Harvest API query parser. Always respond with valid JSON in the specified format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and clean the response
    return {
      queryType: result.queryType || 'time_entries',
      parameters: {
        dateRange: result.parameters?.dateRange || {},
        userId: result.parameters?.userId || null,
        projectId: result.parameters?.projectId || null,
        clientId: result.parameters?.clientId || null,
        filters: result.parameters?.filters || {}
      },
      summaryType: result.summaryType || null
    };
  } catch (error) {
    console.error("OpenAI parsing error:", error);
    throw new Error("Failed to parse natural language query");
  }
}

export async function generateResponse(query: string, data: any, queryType: string): Promise<string> {
  try {
    const prompt = `
You are a helpful Harvest time tracking assistant. Based on the user's query and the data retrieved from Harvest API, provide a clear, conversational response.

User query: "${query}"
Query type: ${queryType}
Data retrieved: ${JSON.stringify(data, null, 2)}

Provide a natural, helpful response that:
1. Acknowledges what the user asked for
2. Summarizes the key findings from the data
3. Mentions any notable patterns or insights
4. Is conversational and friendly

Keep the response concise but informative. If there's no data, explain that clearly.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a helpful Harvest time tracking assistant. Provide clear, conversational responses about time tracking data."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response for that query.";
  } catch (error) {
    console.error("OpenAI response generation error:", error);
    return "I was able to retrieve your data, but had trouble generating a summary. Please check the data table below for details.";
  }
}
