import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessageDto, CitationDto } from '@tenderpulse/shared-types';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  PlusCircle,
  AlertCircle,
  FileText,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import {
  sendChatMessage,
  listChatConversations,
  listChatMessages,
} from '@/api/chat.js';
import { MarkdownMessage } from './MarkdownMessage.js';
import { FinancialSummaryCard } from './FinancialSummaryCard.js';
import { CitationPreviewModal } from './CitationPreviewModal.js';

interface ChatCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bidId?: string;
  companyId?: string;
  tenderTitle?: string;
}

export const ChatCopilotDrawer: React.FC<ChatCopilotDrawerProps> = ({
  isOpen,
  onClose,
  bidId,
  companyId,
  tenderTitle,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<CitationDto | null>(null);
  const [suggestedFollowups, setSuggestedFollowups] = useState<string[]>([
    'What is our 3-year average turnover according to our CA certificate?',
    'What are the stamp paper and notarization rules for this bid?',
    'Do our past projects fulfill the similar work experience threshold?',
    'Summarize the Bid/No-Bid decision recommendation.',
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll messages to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load existing conversation on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadConversation = async () => {
      try {
        const convRes = await listChatConversations({ bidId, companyId });
        if (convRes.ok && convRes.data.length > 0) {
          const activeConv = convRes.data[0];
          if (activeConv) {
            if (isMounted) setConversationId(activeConv.id);

            const msgRes = await listChatMessages(activeConv.id);
            if (msgRes.ok && isMounted) {
              setMessages(msgRes.data);
            }
          }
        }
      } catch {
        // Silently allow fresh chat on network or initialization errors
      }
    };

    loadConversation();
    return () => {
      isMounted = false;
    };
  }, [isOpen, bidId, companyId]);

  // Focus input and handle Escape key when opened
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedCitation) {
          // Modal is open, let modal dismiss first
          return;
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const focusTimeout = setTimeout(() => inputRef.current?.focus(), 150);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimeout);
    };
  }, [isOpen, onClose]);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? inputValue).trim();
      if (!text || isLoading) return;

      setError(null);
      setInputValue('');

      const optimisticUserMsg: ChatMessageDto = {
        id: `temp-${Date.now()}`,
        conversationId: conversationId || 'pending',
        organizationId: 'active-org',
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMsg]);
      setIsLoading(true);

      try {
        const res = await sendChatMessage({
          message: text,
          conversationId: conversationId || undefined,
          bidId,
          companyId,
        });

        if (res.ok) {
          setConversationId(res.data.conversationId);
          setMessages((prev) => {
            // Replace optimistic user msg if pending id
            const withoutTemp = prev.filter((m) => m.id !== optimisticUserMsg.id);
            return [
              ...withoutTemp,
              { ...optimisticUserMsg, conversationId: res.data.conversationId },
              res.data.message,
            ];
          });
          if (res.data.suggestedFollowups && res.data.suggestedFollowups.length > 0) {
            setSuggestedFollowups(res.data.suggestedFollowups);
          }
        } else {
          setError(res.error.message || 'Failed to get response from AI Copilot.');
        }
      } catch {
        setError('Network error while communicating with AI Copilot.');
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, conversationId, bidId, companyId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setSuggestedFollowups([
      'What is our 3-year average turnover according to our CA certificate?',
      'What are the stamp paper and notarization rules for this bid?',
      'Do our past projects fulfill the similar work experience threshold?',
      'Summarize the Bid/No-Bid decision recommendation.',
    ]);
  };

  const handleCitationSelect = (cit: CitationDto) => {
    setSelectedCitation(cit);
  };

  const handleCitationNumberClick = (allCitations: CitationDto[] | null | undefined, num: number) => {
    if (!allCitations || allCitations.length === 0) return;
    const target = allCitations[num - 1] || allCitations[0];
    if (target) {
      setSelectedCitation(target);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 !mt-0 m-0 bg-background/60 backdrop-blur-xs z-30 sm:hidden animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed inset-y-0 right-0 !mt-0 m-0 z-40 w-full sm:w-[540px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between shrink-0 z-10 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-600/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground tracking-wide">
                  Tender AI Copilot
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <ShieldCheck className="w-2.5 h-2.5" /> Grounded
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                {tenderTitle || 'Tender Analysis & Evidence Assistant'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewChat}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Start New Conversation"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close Copilot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-foreground">How can I assist your bid review?</h4>
                <p className="text-[11px] text-muted-foreground max-w-[320px] mx-auto leading-relaxed">
                  Ask questions about EMD requirements, turnover qualifications, execution rules, or past project eligibility.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs shadow-xs ${
                    isUser
                      ? 'bg-primary text-primary-foreground font-normal rounded-tr-xs'
                      : 'bg-muted/50 border border-border/80 text-foreground rounded-tl-xs'
                  }`}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  ) : (
                    <div>
                      <MarkdownMessage
                        content={msg.content}
                        onCitationClick={(citNum) =>
                          handleCitationNumberClick(msg.citations, citNum)
                        }
                      />

                      {/* Financial summary card attachment */}
                      {msg.financialSummary && (
                        <FinancialSummaryCard summary={msg.financialSummary} />
                      )}

                      {/* Structured citations bar */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-border/50">
                          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Grounded Source Citations
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.citations.map((c, cIdx) => (
                              <button
                                key={c.citationId || cIdx}
                                type="button"
                                onClick={() => handleCitationSelect(c)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background hover:bg-muted/70 border border-border/80 text-[11px] text-foreground transition-all cursor-pointer shadow-2xs group hover:border-emerald-500/50 hover:shadow-xs active:scale-[0.98]"
                              >
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">[{cIdx + 1}]</span>
                                <span className="max-w-[160px] sm:max-w-[190px] truncate font-medium">{c.documentName}</span>
                                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted/80 text-muted-foreground">p.{c.pageNumber}</span>
                                <ChevronRight className="w-2.5 h-2.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground transition-all shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5 items-start">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="rounded-xl px-3.5 py-2.5 text-xs bg-muted/50 border border-border/80 text-foreground rounded-tl-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-300" />
                <span className="text-[11px] text-muted-foreground ml-1">Analyzing tender clauses...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Followups */}
        {suggestedFollowups.length > 0 && !isLoading && (
          <div className="px-4 py-2.5 border-t border-border/60 bg-muted/20">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Suggested Questions
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestedFollowups.slice(0, 3).map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="group flex items-center justify-between gap-2 text-left text-[11px] px-3 py-2 rounded-lg bg-card hover:bg-muted/70 hover:border-emerald-500/40 border border-border/80 text-foreground transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                  title={prompt}
                >
                  <span className="truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors font-medium">{prompt}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/70 group-hover:translate-x-0.5 group-hover:text-emerald-600 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 border-t border-border bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-stretch gap-2"
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this tender or your qualification..."
              className="flex-1 text-xs resize-none rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[50px] max-h-32"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-3.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-[0.98]"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Citation Preview Modal */}
      <CitationPreviewModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </>
  );
};
