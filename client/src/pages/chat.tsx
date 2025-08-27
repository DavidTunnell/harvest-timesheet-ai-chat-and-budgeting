import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { MessageBubble } from "@/components/ui/message-bubble";
import { DataTable } from "@/components/ui/data-table";
import { SummaryCard } from "@/components/ui/summary-card";
import { useToast } from "@/hooks/use-toast";
import { Clock, Settings, Send, Mic, Mail, MessageCircle } from "lucide-react";

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  harvestData?: any;
  queryType?: string;
}

interface HarvestStatus {
  connected: boolean;
  message: string;
}

export default function Chat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [emailUser, setEmailUser] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [reportRecipients, setReportRecipients] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check Harvest connection status
  const { data: harvestStatus } = useQuery<HarvestStatus>({
    queryKey: ["/api/harvest/status"],
    refetchInterval: 30000,
  });

  // Load current configuration
  const { data: currentConfig, refetch: refetchConfig } = useQuery<{
    harvestConfigured: boolean;
    emailConfigured: boolean;
    harvestAccountId?: string;
    emailUser?: string;
    reportRecipients?: string;
  }>({
    queryKey: ["/api/config"],
    enabled: isSettingsOpen, // Only load when settings modal is open
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Load report data
  const { data: reportData, isLoading: reportLoading } = useQuery<{
    projects: Array<{
      id: number;
      name: string;
      totalHours: number;
      budget: number;
      budgetUsed: number;
      budgetPercentComplete?: number;
      billedAmount?: number;
      billableHours?: number;
    }>;
    summary: {
      totalHours: number;
      projectCount: number;
      reportDate: string;
    };
  }>({
    queryKey: ["/api/reports/data"],
    enabled: activeTab === "report", // Only load when report tab is active
    refetchOnWindowFocus: false,
  });

  // Trigger config reload when settings modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      refetchConfig();
    }
  }, [isSettingsOpen, refetchConfig]);

  // Load chat history
  const { data: chatHistory } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/history"]
  });

  // Update messages when chat history loads
  useEffect(() => {
    if (chatHistory) {
      setMessages(chatHistory);
    }
  }, [chatHistory]);

  // Update form fields when config loads
  useEffect(() => {
    if (currentConfig && isSettingsOpen) {
      setAccountId(currentConfig.harvestAccountId || "");
      setEmailUser(currentConfig.emailUser || "");
      setReportRecipients(currentConfig.reportRecipients || "");
      // Clear passwords for security when loading
      setAccessToken("");
      setEmailPassword("");
    }
  }, [currentConfig, isSettingsOpen]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", "/api/chat", { message: content });
      return response.json();
    },
    onSuccess: (data) => {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        content: message,
        role: 'user',
        timestamp: new Date().toISOString()
      };

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        harvestData: data,
        queryType: data.queryType
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
    }
  });

  // Configure Harvest mutation
  const configureHarvestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/harvest/config", {
        accountId,
        accessToken
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Harvest API configured successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/harvest/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Error",
        description: error.message || "Failed to configure Harvest API",
        variant: "destructive"
      });
    }
  });

  // Configure Email mutation
  const configureEmailMutation = useMutation({
    mutationFn: async () => {
      // Allow partial updates if email is already configured
      const isUpdate = currentConfig?.emailConfigured;
      
      const body: any = {};
      if (emailUser) body.emailUser = emailUser;
      if (emailPassword) body.emailPassword = emailPassword;
      if (reportRecipients !== undefined) body.reportRecipients = reportRecipients || "david@webapper.com";
      
      // For new configurations, require both email and password
      if (!isUpdate && (!emailUser || !emailPassword)) {
        throw new Error("Email user and password are required for initial setup");
      }
      
      const response = await apiRequest("POST", "/api/email/config", body);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Email configuration saved successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Email Configuration Error",
        description: error.message || "Failed to configure email settings",
        variant: "destructive"
      });
    }
  });

  // Test weekly report mutation
  const testReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reports/trigger");
      return response.json();
    },
    onSuccess: () => {
      const recipients = currentConfig?.reportRecipients || "configured recipients";
      toast({
        title: "Success",
        description: `Test report sent successfully to ${recipients}`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Report Error",
        description: error.message || "Failed to send test report",
        variant: "destructive"
      });
    }
  });

  const handleSaveAllSettings = () => {
    if (accountId && accessToken) {
      configureHarvestMutation.mutate();
    }
    // Trigger email mutation if any email field has a value or if email is already configured and we're updating recipients
    if (emailUser || emailPassword || (currentConfig?.emailConfigured && reportRecipients !== undefined)) {
      configureEmailMutation.mutate();
    }
    // At least one configuration should be saved or updated
    const harvestChanging = accountId || accessToken;
    const emailChanging = emailUser || emailPassword || reportRecipients;
    const harvestAlreadyConfigured = currentConfig?.harvestConfigured;
    const emailAlreadyConfigured = currentConfig?.emailConfigured;
    
    if (!harvestChanging && !emailChanging && !harvestAlreadyConfigured && !emailAlreadyConfigured) {
      toast({
        title: "No Settings to Save",
        description: "Please configure at least Harvest API or Email settings",
        variant: "destructive"
      });
      return;
    }
    
    // Only close modal if all attempted configurations succeeded
    setTimeout(() => {
      setIsSettingsOpen(false);
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    if (!harvestStatus?.connected) {
      toast({
        title: "Not Connected",
        description: "Please configure your Harvest API credentials first",
        variant: "destructive"
      });
      return;
    }

    sendMessageMutation.mutate(message);
  };

  const handleQuickAction = (actionMessage: string) => {
    setMessage(actionMessage);
  };

  const quickActions = [
    { label: "This week's hours", message: "Show me my time entries for this week" },
    { label: "My projects", message: "What projects am I working on?" },
    { label: "All clients", message: "Show me all clients and their active projects" },
    { label: "Yesterday's work", message: "How many hours did I log yesterday?" },
  ];

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto bg-white shadow-xl">
      {/* Header */}
      <header className="bg-harvest-orange text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8" data-testid="icon-harvest-clock" />
            <div>
              <h1 className="text-xl font-bold">Harvest API Assistant</h1>
              <p className="text-orange-100 text-sm">Ask questions about your time tracking data</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              harvestStatus?.connected 
                ? 'bg-green-500' 
                : 'bg-red-500'
            }`} data-testid="status-connection">
              <div className={`w-2 h-2 bg-white rounded-full ${
                harvestStatus?.connected ? 'animate-pulse' : ''
              }`}></div>
              <span>{harvestStatus?.connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-harvest-dark"
                  data-testid="button-settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Harvest API Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-harvest-orange" />
                      <h3 className="text-lg font-semibold">Harvest API</h3>
                    </div>
                    <div>
                      <Label htmlFor="accountId">Account ID</Label>
                      <Input
                        id="accountId"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        placeholder="Your Harvest Account ID"
                        data-testid="input-account-id"
                      />
                    </div>
                    <div>
                      <Label htmlFor="accessToken">Personal Access Token</Label>
                      <Input
                        id="accessToken"
                        type="password"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder={currentConfig?.harvestConfigured ? "********" : "Your Harvest API Token"}
                        data-testid="input-access-token"
                      />
                    </div>
                  </div>

                  {/* Email Settings Section */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">Email Reports</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Configure email settings to send weekly project budget reports every Monday at 8:00 AM CST.
                    </p>
                    <div>
                      <Label htmlFor="emailUser">Gmail Address</Label>
                      <Input
                        id="emailUser"
                        type="email"
                        value={emailUser}
                        onChange={(e) => setEmailUser(e.target.value)}
                        placeholder="your-email@gmail.com"
                        data-testid="input-email-user"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emailPassword">Gmail App Password</Label>
                      <Input
                        id="emailPassword"
                        type="password"
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        placeholder={currentConfig?.emailConfigured ? "********" : "Gmail App Password (not your regular password)"}
                        data-testid="input-email-password"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Generate an App Password in your Google Account settings under Security → 2-Step Verification → App passwords.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="reportRecipients">Report Recipients</Label>
                      <Input
                        id="reportRecipients"
                        type="email"
                        value={reportRecipients}
                        onChange={(e) => setReportRecipients(e.target.value)}
                        placeholder="email1@domain.com, email2@domain.com"
                        data-testid="input-report-recipients"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter email addresses separated by commas to receive weekly budget reports.
                      </p>
                    </div>
                    
                    {/* Test Report Button */}
                    <Button 
                      variant="outline"
                      onClick={() => testReportMutation.mutate()}
                      disabled={testReportMutation.isPending}
                      className="w-full"
                      data-testid="button-test-report"
                    >
                      {testReportMutation.isPending ? "Sending..." : "Send Test Report"}
                    </Button>
                  </div>

                  {/* Save All Button */}
                  <Button 
                    onClick={handleSaveAllSettings}
                    disabled={configureHarvestMutation.isPending || configureEmailMutation.isPending}
                    className="w-full bg-harvest-orange hover:bg-harvest-dark"
                    data-testid="button-save-all-settings"
                  >
                    {(configureHarvestMutation.isPending || configureEmailMutation.isPending) ? "Saving..." : "Save All Settings"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat" className="flex items-center space-x-2">
            <MessageCircle className="h-4 w-4" />
            <span>Chat</span>
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center space-x-2">
            <Mail className="h-4 w-4" />
            <span>Weekly Report</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
          {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[70vh]" data-testid="chat-messages">
        {/* Welcome Message */}
        {messages.length === 0 && (
          <MessageBubble
            role="assistant"
            content="Hello! I'm your Harvest API assistant. I can help you query your time tracking data using natural language."
            timestamp={new Date().toISOString()}
            extraContent={
              <div className="text-gray-600 mt-2">
                <p>Try asking me things like:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>"Show me my time entries for this week"</li>
                  <li>"What projects am I working on?"</li>
                  <li>"How many hours did I log yesterday?"</li>
                  <li>"Show me all clients and their active projects"</li>
                </ul>
              </div>
            }
          />
        )}

        {/* Chat Messages */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
            extraContent={
              msg.role === 'assistant' && msg.harvestData && (
                <div className="mt-4 space-y-4">
                  {/* Data Table */}
                  {msg.harvestData.data && Array.isArray(msg.harvestData.data) && msg.harvestData.data.length > 0 && (
                    <DataTable 
                      data={msg.harvestData.data} 
                      queryType={msg.queryType || 'time_entries'} 
                    />
                  )}
                  
                  {/* Summary Card */}
                  {msg.harvestData.summary && (
                    <SummaryCard summary={msg.harvestData.summary} />
                  )}
                </div>
              )
            }
          />
        ))}

        {/* Loading Message */}
        {sendMessageMutation.isPending && (
          <MessageBubble
            role="assistant"
            content=""
            timestamp={new Date().toISOString()}
            isLoading={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex space-x-3" data-testid="form-chat">
          <div className="flex-1 relative">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask a question about your Harvest data..."
              className="w-full pr-10"
              data-testid="input-message"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Mic className="h-4 w-4 text-gray-400 hover:text-harvest-orange cursor-pointer transition-colors" />
            </div>
          </div>
          <Button 
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending || !harvestStatus?.connected}
            className="bg-harvest-orange hover:bg-harvest-dark"
            data-testid="button-send"
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </form>
        
        {/* Quick Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.message)}
              className="text-sm"
              data-testid={`button-quick-${index}`}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="report" className="flex-1">
          <div className="h-full w-full overflow-y-auto bg-white">
            <div className="w-full p-8">
              {/* Weekly Report Content */}
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white p-8 rounded-lg mb-8 text-center">
                <h1 className="text-3xl font-bold mb-2">Weekly Project Budget Report</h1>
                <p className="text-orange-100">
                  {reportData?.summary?.reportDate || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Month-to-Date Summary</h2>
                <p className="text-gray-600">This report shows the total hours and budget utilization for each project so far this month.</p>
              </div>

              {reportLoading ? (
                <div className="bg-white rounded-lg shadow-lg p-8 mb-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading real project data from Harvest...</p>
                </div>
              ) : reportData && reportData.projects && reportData.projects.length > 0 ? (
                <div className="space-y-8 mb-8">
                  {/* Primary Projects Table */}
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Primary Projects</h2>
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-800 text-white">
                          <tr>
                            <th className="px-6 py-4 text-left">Project Name</th>
                            <th className="px-6 py-4 text-center">Hours Logged</th>
                            <th className="px-6 py-4 text-center">Billable Hours</th>
                            <th className="px-6 py-4 text-center">Budget Spent</th>
                            <th className="px-6 py-4 text-center">Budget %</th>
                            <th className="px-6 py-4 text-center">Total Budget</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.projects.map((project, index) => (
                            <tr key={project.id} className="border-b">
                              <td className="px-6 py-4 font-medium">{project.name}</td>
                              <td className="px-6 py-4 text-center">{project.totalHours.toFixed(1)}h</td>
                              <td className="px-6 py-4 text-center">{project.billableHours?.toFixed(1) || '0'}h</td>
                              <td className="px-6 py-4 text-center">${project.billedAmount?.toFixed(2) || '0.00'}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={
                                  (project.budgetPercentComplete || 0) > 90 ? 'text-red-600 font-semibold' : 
                                  (project.budgetPercentComplete || 0) > 75 ? 'text-yellow-600 font-semibold' : 
                                  'text-green-600'
                                }>
                                  {(project.budgetPercentComplete || 0).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {project.budget > 0 ? `$${project.budget.toLocaleString()}` : 'No Budget Set'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* BHS Projects Table */}
                  {reportData.bhsProjects && reportData.bhsProjects.length > 0 && (
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Basic Hosting Support (BHS) Projects</h2>
                      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-800 text-white">
                            <tr>
                              <th className="px-6 py-4 text-left">Client Name</th>
                              <th className="px-6 py-4 text-center">Hours Logged</th>
                              <th className="px-6 py-4 text-center">Support Hours</th>
                              <th className="px-6 py-4 text-center">Budget %</th>
                              <th className="px-6 py-4 text-center">Total Budget</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.bhsProjects.map((project, index) => {
                              // Calculate budget percentage for hours (hours logged / support hours budget)
                              const budgetPercent = project.budget > 0 ? (project.totalHours / project.budget) * 100 : 0;
                              // Calculate total budget: $150 × Support Hours
                              const totalBudget = project.budget > 0 ? project.budget * 150 : 0;
                              return (
                                <tr key={project.id} className="border-b">
                                  <td className="px-6 py-4 font-medium">{project.name}</td>
                                  <td className="px-6 py-4 text-center">{project.totalHours.toFixed(1)}h</td>
                                  <td className="px-6 py-4 text-center">{project.budget > 0 ? `${project.budget}h` : 'No Budget Set'}</td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={
                                      budgetPercent > 100 ? 'text-red-600 font-semibold' : 
                                      budgetPercent > 85 ? 'text-yellow-600 font-semibold' : 
                                      'text-green-600'
                                    }>
                                      {budgetPercent.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">${totalBudget.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-lg p-8 mb-8 text-center">
                  <p className="text-gray-600 mb-4">No project data found for this month.</p>
                  <p className="text-sm text-gray-500">Make sure you have time entries logged in Harvest for the current month.</p>
                </div>
              )}

              <div className="bg-gray-100 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Summary</h3>
                <div className="space-y-2">
                  <p><strong>Total Hours This Month:</strong> {
                    ((reportData?.projects?.reduce((sum, p) => sum + (p.totalHours || 0), 0) || 0) + 
                     (reportData?.bhsProjects?.reduce((sum, p) => sum + (p.totalHours || 0), 0) || 0)).toFixed(1)
                  } hours</p>
                  <p><strong>Total Billable Hours:</strong> {
                    ((reportData?.projects?.reduce((sum, p) => sum + (p.billableHours || 0), 0) || 0) + 
                     (reportData?.bhsProjects?.reduce((sum, p) => sum + (p.budget || 0), 0) || 0)).toFixed(1)
                  } hours</p>
                  <p><strong>Total Amount Billed:</strong> ${
                    ((reportData?.projects?.reduce((sum, p) => sum + (p.budget || 0), 0) || 0) + 
                     (reportData?.bhsProjects?.reduce((sum, p) => sum + ((p.budget || 0) * 150), 0) || 0)).toFixed(2)
                  }</p>
                  <p><strong>Projects Tracked:</strong> {((reportData?.projects?.length || 0) + (reportData?.bhsProjects?.length || 0))}</p>
                </div>
              </div>

            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
