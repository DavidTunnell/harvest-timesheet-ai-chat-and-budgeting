import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageBubble } from "@/components/ui/message-bubble";
import { DataTable } from "@/components/ui/data-table";
import { SummaryCard } from "@/components/ui/summary-card";
import { useToast } from "@/hooks/use-toast";
import { Clock, Settings, Send, Mic } from "lucide-react";

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
    queryKey: ["/api/harvest/status"],
    refetchInterval: 30000,
  });

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
      setIsSettingsOpen(false);
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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Harvest API Configuration</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
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
                      placeholder="Your Harvest API Token"
                      data-testid="input-access-token"
                    />
                  </div>
                  <Button 
                    onClick={() => configureHarvestMutation.mutate()}
                    disabled={!accountId || !accessToken || configureHarvestMutation.isPending}
                    className="w-full"
                    data-testid="button-save-config"
                  >
                    {configureHarvestMutation.isPending ? "Saving..." : "Save Configuration"}
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
    </div>
  );
}
