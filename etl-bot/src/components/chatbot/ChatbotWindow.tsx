// src/components/chatbot/ChatbotWindow.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, X, Bot, User, Loader2 } from 'lucide-react';
import axiosInstance from '@/lib/axios-instance'; // Use your configured axios instance

interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
}

interface ChatbotWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatbotWindow: React.FC<ChatbotWindowProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', sender: 'system', text: 'Hello! Ask me anything.' }
  ]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
        // Timeout needed to allow transition/render
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);


  const getErrorMessage = useCallback((error: any): string => {
     if (error instanceof (error as any).isAxiosError) {
          const data = error.response?.data;
          if (data && typeof data === 'object' && 'detail' in data) {
              return String(data.detail);
          }
          if (typeof data === 'string') return data;
          return error.message;
      }
      if (error instanceof Error) return error.message;
      return "An unknown error occurred.";
  }, []);


  const handleSend = async () => {
    const trimmedInput = userInput.trim();
    if (!trimmedInput || isLoading) return;

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmedInput,
    };

    setMessages(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await axiosInstance.post<{ reply: string }>('/api/chatbot/chat', {
        prompt: trimmedInput,
      });

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.data.reply,
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error("Chatbot API error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        sender: 'system', // Or create a specific 'error' sender style
        text: `Error: ${getErrorMessage(error)}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Refocus input after response/error
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent newline
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="fixed bottom-20 left-4 w-80 h-[500px] z-50 shadow-xl flex flex-col bg-card text-card-foreground border">
      <CardHeader className="flex flex-row items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">PromptQ Assistant</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-grow p-0 overflow-hidden">
        <ScrollArea className="h-full p-3" ref={scrollAreaRef}>
          <div className="space-y-4 text-sm">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.sender === 'ai' && (
                  <Avatar className="h-6 w-6 flex-shrink-0">
                     <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={14}/></AvatarFallback>
                  </Avatar>
                )}
                 {message.sender === 'system' && (
                  <Avatar className="h-6 w-6 flex-shrink-0">
                     <AvatarFallback className="bg-muted text-muted-foreground"><Bot size={14}/></AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-3 py-1.5 break-words ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.sender === 'ai'
                        ? 'bg-muted'
                        : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-center w-full italic' // System/Error style
                  }`}
                >
                  {message.text}
                </div>

                {message.sender === 'user' && (
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground"><User size={14}/></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center justify-start gap-2">
                 <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={14}/></AvatarFallback>
                 </Avatar>
                <div className="bg-muted rounded-lg px-3 py-1.5 flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 border-t">
        <div className="flex w-full items-center gap-2">
          <Textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-grow resize-none text-sm h-10 max-h-24 min-h-10 pr-10" // Added paddingRight for button overlap
            rows={1}
            disabled={isLoading}
          />
          <Button
             type="submit"
             size="icon"
             onClick={handleSend}
             disabled={isLoading || !userInput.trim()}
             className="absolute right-4 bottom-4 h-7 w-7" // Position button inside textarea area
            >
            <Send className="h-4 w-4" />
             <span className="sr-only">Send</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};