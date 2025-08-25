import { Clock, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isLoading?: boolean;
  extraContent?: React.ReactNode;
}

export function MessageBubble({ role, content, timestamp, isLoading, extraContent }: MessageBubbleProps) {
  const isUser = role === 'user';
  
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className={cn(
      "flex items-start space-x-3",
      isUser ? "justify-end" : ""
    )} data-testid={`message-${role}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 bg-harvest-orange rounded-full flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      
      <div className={cn(
        "max-w-3xl rounded-lg p-4 shadow-sm",
        isUser 
          ? "bg-user-bubble text-white" 
          : "bg-white border border-gray-200"
      )}>
        <div className={cn(
          "text-sm mb-2",
          isUser ? "text-blue-100" : "text-gray-600"
        )}>
          {isUser ? "You" : "Assistant"} • {formatTime(timestamp)}
        </div>
        
        {isLoading ? (
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-harvest-orange"></div>
            <span className="text-gray-600">Querying your Harvest data...</span>
          </div>
        ) : (
          <>
            {content && <div className="prose prose-sm max-w-none">{content}</div>}
            {extraContent}
          </>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 bg-user-bubble rounded-full flex items-center justify-center">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}
