// frontend/src/components/ChatBot.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { askQuestion, type ChatResponse, type DecisionTrace } from "../api/chatClient";
import { ConversationSidebar, type Conversation } from "./ConversationSidebar";
import { ApiErrorPanel } from "./ApiErrorPanel";
import { toApiErrorDetails, type ApiErrorDetails } from "../lib/api";

interface Message {
  role: string;
  content: string;
  trace?: DecisionTrace;
}

interface ConversationData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  sessionId: string | null;
}

const STORAGE_KEY = "autocomply_conversations";
const ACTIVE_CONVERSATION_KEY = "autocomply_active_conversation";

const DEMO_QUESTIONS = [
  "What is a Schedule II drug?",
  "What are requirements for Schedule II controlled substances in Florida?",
  "What is Ohio TDDD and when is it required?",
  "What are Schedule IV shipping rules for New Jersey?",
  "What are Schedule IV shipping rules for Rhode Island?",
  "How do I get a DEA license in Texas?",
];

function isAdminUnlocked(): boolean {
  return localStorage.getItem("admin_unlocked") === "true";
}

export function ChatBot() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoQuestions, setShowDemoQuestions] = useState(true);
  const [errorDetails, setErrorDetails] = useState<ApiErrorDetails | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];
  const sessionId = activeConversation?.sessionId || null;

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
    if (stored) {
      try {
        const parsed: ConversationData[] = JSON.parse(stored);
        setConversations(parsed);
        if (activeId && parsed.find((c) => c.id === activeId)) {
          setActiveConversationId(activeId);
        } else if (parsed.length > 0) {
          setActiveConversationId(parsed[0].id);
        } else {
          createNewConversation();
        }
      } catch (e) {
        console.error("Failed to load conversations:", e);
        createNewConversation();
      }
    } else {
      createNewConversation();
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
    }
  }, [activeConversationId]);

  const createNewConversation = () => {
    const newConv: ConversationData = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      sessionId: null,
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
  };

  const selectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (id === activeConversationId) {
        if (filtered.length > 0) {
          setActiveConversationId(filtered[0].id);
        } else {
          setTimeout(createNewConversation, 0);
        }
      }
      if (filtered.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
      }
      return filtered;
    });
  };

  const updateConversation = (id: string, updates: Partial<ConversationData>) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c))
    );
  };

  const handleDemoQuestion = (demoQuestion: string) => {
    if (loading || !activeConversationId) return;
    setQuestion(demoQuestion);
    // Auto-submit after a brief delay to show the question in the input
    setTimeout(() => {
      const syntheticEvent = new Event('submit', { bubbles: true, cancelable: true }) as any;
      syntheticEvent.preventDefault = () => {};
      handleSubmit(syntheticEvent);
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !activeConversationId) return;
    const userQuestion = question.trim();
    setQuestion("");
    setLoading(true);
    setErrorDetails(null);
    const userMessage: Message = { role: "user", content: userQuestion };
    const updatedMessages = [...messages, userMessage];
    const isFirstMessage = messages.length === 0;
    const title = isFirstMessage
      ? userQuestion.length > 40 ? userQuestion.substring(0, 40) + "..." : userQuestion
      : activeConversation?.title || "New conversation";
    updateConversation(activeConversationId, { messages: updatedMessages, title });
    try {
      const response: ChatResponse = await askQuestion({
        question: userQuestion,
        session_id: sessionId || undefined,
      });
      const assistantMessage: Message = {
        role: "assistant",
        content: response.answer,
        trace: response.decision_trace,
      };
      updateConversation(activeConversationId, {
        messages: [...updatedMessages, assistantMessage],
        sessionId: response.session_id,
        title,
      });
    } catch (error) {
      console.error("Chat error:", error);
      setErrorDetails(toApiErrorDetails(error, { url: "/api/chat/ask" }));
      const errorMessage: Message = { role: "assistant", content: "Backend failed to queue item. Please try again." };
      updateConversation(activeConversationId, { messages: [...updatedMessages, errorMessage] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-gray-900 text-gray-100">
      <ConversationSidebar
        conversations={conversations.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }))}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewConversation={createNewConversation}
        onDeleteConversation={deleteConversation}
      />
      <div className="flex-1 flex flex-col">
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <h2 className="text-xl font-bold">AutoComply AI Chatbot</h2>
          <p className="text-sm text-gray-400">
            {activeConversation?.title || "Learn After First Unknown - Powered by Knowledge Base"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorDetails && (
            <ApiErrorPanel
              error={errorDetails}
              title="Chat request failed"
            />
          )}
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-lg mb-2">👋 Ask me anything about compliance!</p>
              <p className="text-sm">I'll search our knowledge base for answers. If I don't know something, it will be queued for human review.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] rounded-lg p-4 ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-800 border border-gray-700"}`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.role === "assistant" && msg.trace && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-gray-400 hover:text-gray-300"> Decision Trace</summary>
                    <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-700 space-y-1">
                      <div>
                        <span className="text-gray-400">Decision: </span>
                        <span className={msg.trace.gating_decision === "ANSWERED" ? "text-green-400" : "text-yellow-400"}>{msg.trace.gating_decision}</span>
                      </div>
                      {msg.trace.top_match_score !== null && (
                        <div>
                          <span className="text-gray-400">Top Match Score: </span>
                          <span className="text-blue-400">{(msg.trace.top_match_score * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">Threshold: </span>
                        <span className="text-gray-300">{(msg.trace.similarity_threshold * 100).toFixed(1)}%</span>
                      </div>
                      {msg.trace.reason_code && (
                        <div>
                          <span className="text-gray-400">Reason: </span>
                          <span className="text-orange-400">{msg.trace.reason_code}</span>
                        </div>
                      )}
                      {msg.trace.queue_item_id && (
                        <div>
                          <span className="text-gray-400">Queue Item ID: </span>
                          <span className="text-purple-400">#{msg.trace.queue_item_id}</span>
                        </div>
                      )}
                      {msg.trace.top_3_matches && msg.trace.top_3_matches.length > 0 && (
                        <div className="mt-2">
                          <div className="text-gray-400 mb-1">Top Matches:</div>
                          {msg.trace.top_3_matches.map((match, i) => (
                            <div key={i} className="ml-2 text-gray-500">
                              {i + 1}. {match.canonical_question.substring(0, 50)}...
                              <span className="text-blue-400 ml-2">({(match.score * 100).toFixed(1)}%)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
              {msg.role === "assistant" && msg.trace?.queue_item_id && (
                <div className="mt-2 max-w-[80%] flex items-center gap-2 text-sm">
                  <span className="text-yellow-400">
                    ⏳ Queued for review: #{msg.trace.queue_item_id}
                  </span>
                  {isAdminUnlocked() && (
                    <button
                      onClick={() => navigate("/admin/review")}
                      className="px-3 py-1 bg-cyan-600/20 border border-cyan-500/50 text-cyan-300 rounded hover:bg-cyan-600/30 transition-colors text-xs font-medium"
                    >
                      Open Review Queue →
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-100"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-200"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Demo Questions Panel */}
        <div className="border-t border-gray-700 bg-gray-850">
          <button
            onClick={() => setShowDemoQuestions(!showDemoQuestions)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 transition-colors"
          >
            <span className="font-medium">💡 Demo Questions</span>
            <span className="text-xs">{showDemoQuestions ? '▼' : '▶'}</span>
          </button>
          {showDemoQuestions && (
            <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {DEMO_QUESTIONS.map((dq, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDemoQuestion(dq)}
                  disabled={loading}
                  className="text-left p-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded text-sm text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex-1">{dq}</span>
                    <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">Send →</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="border-t border-gray-700 p-4">
          <div className="flex space-x-2">
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a compliance question..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500" disabled={loading} />
            <button type="submit" disabled={loading || !question.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">Send</button>
          </div>
        </form>
      </div>
    </div>
  );
}
