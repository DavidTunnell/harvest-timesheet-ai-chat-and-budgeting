import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageBubble } from "@/components/ui/message-bubble";
import { useToast } from "@/hooks/use-toast";
import { Clock, Settings, Send, Mic, Mail, FileBarChart } from "lucide-react";
import { Link } from "wouter";

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
    queryKey: ['/api/harvest/status'],
    queryFn: () => fetch('/api/harvest/status').then(res => res.json()),
    refetchInterval: 30000,
  });

  // Fetch chat history
  const { data: chatHistory = [] } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/history'],
    queryFn: () => fetch('/api/chat/history').then(res => res.json()),
  });

  // Get current configuration
  const { data: currentConfig } = useQuery<any>({
    queryKey: ['/api/config'],
    queryFn: () => fetch('/api/config').then(res => res.json()),
  });

  // Update messages when chat history loads
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      setMessages(chatHistory);
    }
  }, [chatHistory]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest('/api/chat', {
        method: 'POST',
        body: { message: userMessage },
      });
      return response;
    },
    onSuccess: (response) => {
      // Add the new messages to the local state
      setMessages(prev => [
        ...prev,
        response.userMessage,
        response.assistantMessage
      ]);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/history'] });
    },
    onError: (error: any) => {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Configure Harvest mutation
  const configureHarvestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/harvest/configure', {
        method: 'POST',
        body: { accountId, accessToken },
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Harvest connection configured successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/harvest/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure Harvest",
        variant: "destructive",
      });
    },
  });

  // Configure Email mutation
  const configureEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/email/configure', {
        method: 'POST',
        body: { 
          emailUser: emailUser.trim(),
          emailPassword: emailPassword.trim(),
          reportRecipients: reportRecipients.trim()
        },
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Email configuration saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to configure email",
        variant: "destructive",
      });
    },
  });

  // Test report mutation
  const testReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/reports/trigger', {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test report sent successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test report",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessageMutation.isPending) return;

    const userMessage = message.trim();
    setMessage("");
    
    // Add user message immediately to the UI
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content: userMessage,
      role: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      await sendMessageMutation.mutateAsync(userMessage);
    } catch (error) {
      // Remove the temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    }
  };

  const handleSaveAllSettings = async () => {
    const promises = [];
    
    if (accountId && accessToken) {
      promises.push(configureHarvestMutation.mutateAsync());
    }
    
    if (emailUser && emailPassword && reportRecipients) {
      promises.push(configureEmailMutation.mutateAsync());
    }

    try {
      await Promise.all(promises);
      setIsSettingsOpen(false);
    } catch (error) {
      // Individual mutations will handle their own error messages
    }
  };

  // Load existing config when settings dialog opens
  useEffect(() => {
    if (currentConfig && isSettingsOpen) {
      if (currentConfig.harvestConfigured) {
        // Don't overwrite if user has entered values
        if (!accountId) setAccountId('');
        if (!accessToken) setAccessToken('');
      }
      if (currentConfig.emailConfigured) {
        if (!emailUser) setEmailUser(currentConfig.emailUser || '');
        if (!reportRecipients) setReportRecipients(currentConfig.reportRecipients || '');
        // Don't pre-fill password for security
      }
    }
  }, [currentConfig, isSettingsOpen, accountId, accessToken, emailUser, reportRecipients]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Harvest Assistant</h1>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                harvestStatus?.connected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                {harvestStatus?.connected ? 'Connected to Harvest' : 'Not connected'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Monthly Report Link */}
            <Link href="/report">
              <Button variant="outline" className="flex items-center space-x-2">
                <FileBarChart size={18} />
                <span>Monthly Report</span>
              </Button>
            </Link>

            {/* Settings Dialog */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" data-testid="settings-dialog">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Harvest Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-harvest-orange" />
                      <h3 className="text-lg font-semibold">Harvest API</h3>
                      {currentConfig?.harvestConfigured && (
                        <div className="flex items-center space-x-1 text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-xs">Configured</span>
                        </div>
                      )}
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
                      <Label htmlFor="accessToken">Access Token</Label>
                      <Input
                        id="accessToken"
                        type="password"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder={currentConfig?.harvestConfigured ? "********" : "Your Personal Access Token"}
                        data-testid="input-access-token"
                      />
                    </div>
                  </div>

                  {/* Email Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-5 w-5 text-blue-500" />
                      <h3 className="text-lg font-semibold">Email Reports</h3>
                      {currentConfig?.emailConfigured && (
                        <div className="flex items-center space-x-1 text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-xs">Configured</span>
                        </div>
                      )}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
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
                  <li>"Which project has the highest budget utilization?"</li>
                </ul>
                <p className="mt-2 text-sm">
                  You can also view the <Link href="/report" className="text-orange-600 hover:underline">Monthly Report</Link> for detailed budget tracking.
                </p>
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
            data={msg.harvestData}
          />
        ))}

        {/* Loading indicator */}
        {sendMessageMutation.isPending && (
          <div className="flex justify-start">
            <Card className="bg-gray-100 max-w-xs">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                  <span className="text-gray-600">Processing...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
        <div className="flex space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about your time entries, projects, or budget..."
            disabled={sendMessageMutation.isPending}
            className="flex-1"
            data-testid="input-message"
          />
          <Button 
            type="submit" 
            disabled={sendMessageMutation.isPending || !message.trim()}
            className="bg-harvest-orange hover:bg-harvest-dark"
            data-testid="button-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}