// frontend/src/components/ChatBot.tsx
import { useState } from "react";
import { askQuestion, type ChatResponse, type DecisionTrace } from "../api/chatClient";

export function ChatBot() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{
    role: string;
    content: string;
    trace?: DecisionTrace;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) return;

    const userQuestion = question.trim();
    setQuestion("");
    setLoading(true);

    // Add user message
    setMessages(prev => [...prev, {
      role: "user",
      content: userQuestion
    }]);

    try {
      const response: ChatResponse = await askQuestion({
        question: userQuestion,
        session_id: sessionId || undefined
      });

      setSessionId(response.session_id);

      // Add assistant message
      setMessages(prev => [...prev, {
        role: "assistant",
        content: response.answer,
        trace: response.decision_trace
      }]);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, an error occurred. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <h2 className="text-xl font-bold">AutoComply AI Chatbot</h2>
        <p className="text-sm text-gray-400">
          Learn After First Unknown - Powered by Knowledge Base
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">👋 Ask me anything about compliance!</p>
            <p className="text-sm">
              I'll search our knowledge base for answers. If I don't know something,
              it will be queued for human review.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 border border-gray-700"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              
              {/* Decision Trace (only for assistant messages) */}
              {msg.role === "assistant" && msg.trace && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                    🔍 Decision Trace
                  </summary>
                  <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-700 space-y-1">
                    <div>
                      <span className="text-gray-400">Decision:</span>{" "}
                      <span className={msg.trace.gating_decision === "ANSWERED" ? "text-green-400" : "text-yellow-400"}>
                        {msg.trace.gating_decision}
                      </span>
                    </div>
                    
                    {msg.trace.top_match_score !== null && (
                      <div>
                        <span className="text-gray-400">Top Match Score:</span>{" "}
                        <span className="text-blue-400">
                          {(msg.trace.top_match_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    
                    <div>
                      <span className="text-gray-400">Threshold:</span>{" "}
                      <span className="text-gray-300">
                        {(msg.trace.similarity_threshold * 100).toFixed(1)}%
                      </span>
                    </div>

                    {msg.trace.reason_code && (
                      <div>
                        <span className="text-gray-400">Reason:</span>{" "}
                        <span className="text-orange-400">{msg.trace.reason_code}</span>
                      </div>
                    )}

                    {msg.trace.queue_item_id && (
                      <div>
                        <span className="text-gray-400">Queue Item ID:</span>{" "}
                        <span className="text-purple-400">#{msg.trace.queue_item_id}</span>
                      </div>
                    )}

                    {msg.trace.top_3_matches && msg.trace.top_3_matches.length > 0 && (
                      <div className="mt-2">
                        <div className="text-gray-400 mb-1">Top Matches:</div>
                        {msg.trace.top_3_matches.map((match, i) => (
                          <div key={i} className="ml-2 text-gray-500">
                            {i + 1}. {match.canonical_question.substring(0, 50)}...
                            <span className="text-blue-400 ml-2">
                              ({(match.score * 100).toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
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

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t border-gray-700 p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a compliance question..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
