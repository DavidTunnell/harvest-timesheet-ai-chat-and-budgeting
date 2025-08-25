# Overview

This is a Harvest Chat Assistant - a full-stack web application that provides a natural language interface for querying Harvest time tracking data. Users can ask questions in plain English about their time entries, projects, and clients, and receive structured responses with data visualizations.

The application integrates with the Harvest API to fetch time tracking data and uses OpenAI's GPT for natural language processing to convert user queries into appropriate API calls. It features a modern chat interface with real-time data tables and summary cards.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints with centralized route registration
- **Error Handling**: Centralized error middleware with structured error responses
- **Request Logging**: Custom middleware for API request/response logging

## Data Storage
- **Database**: PostgreSQL with Drizzle ORM for schema management and queries
- **Connection**: Neon serverless PostgreSQL database
- **Schema**: Defined in shared TypeScript files with Zod validation schemas
- **Migrations**: Drizzle Kit for database schema migrations
- **Storage Interface**: Abstracted storage layer with in-memory fallback for development

## Database Schema
- **Users**: Basic user authentication with username/password
- **Chat Messages**: Conversation history with role, content, and associated Harvest data
- **Harvest Config**: Encrypted API credentials for Harvest integration

## Authentication & Authorization
- **Session Management**: PostgreSQL-based sessions using connect-pg-simple
- **API Security**: Harvest API credentials stored securely in database
- **Request Authentication**: Session-based authentication for API endpoints

# External Dependencies

## Third-Party APIs
- **Harvest API**: Time tracking data retrieval (v2 REST API)
  - Account ID and Access Token authentication
  - Time entries, projects, clients, and users endpoints
  - Rate limiting and error handling implementation

- **OpenAI API**: Natural language processing for query parsing
  - GPT-5 model for converting natural language to structured queries
  - Custom prompts for Harvest-specific data extraction
  - Response generation and summarization

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
  - Connection pooling and automatic scaling
  - Environment-based connection string configuration

## Development Tools
- **Replit Integration**: Development environment optimization
  - Custom Vite plugins for error handling and cartographer
  - Banner injection for development mode detection

## UI Component Libraries
- **Radix UI**: Headless component primitives for accessibility
- **Lucide Icons**: Consistent iconography throughout the application
- **React Day Picker**: Calendar component for date selection
- **Recharts**: Data visualization for summary charts

## Build & Development
- **Vite**: Frontend build tool with hot module replacement
- **esbuild**: Backend bundling for production deployment
- **PostCSS**: CSS processing with Tailwind CSS compilation
- **TypeScript**: Type safety across frontend, backend, and shared schemas