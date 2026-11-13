// src/components/MoonAssistant.jsx
// AI-powered educational chatbot using Local scenario tools
// Architectural Blue & Silver Theme · Embedded and Floating Modes

import { useState, useRef, useEffect } from 'react';
import {answerGuideQuestion} from '../lib/projectGuideTools.js';
import { Bot, Send, X, Trash2, MessageCircle } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  "What if landing is delayed by 3 days?",
  "What is a permanently shadowed region (PSR)?",
  "How does solar power work when the Sun skims the lunar horizon?",
  "What is Direct-to-Earth communication and how does libration affect it?",
  "Why does Earth hover near the horizon from the south pole?",
  "How cold are the crater floors at the lunar south pole?",
  "How does lunar topography affect solar panel incidence angles?",
];

export default function MoonAssistant({ site, date, power, comm, embedded = false, scenario, timeWindow, onNavigate, onComparePins }) {
  const [isOpen, setIsOpen] = useState(embedded);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if(loading)return;
    const userMsg = (text || input).trim().slice(0,1200);
    if (!userMsg) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const reply=await answerGuideQuestion(userMsg,{site,date,power,comm,scenario,timeWindow,activeTab:'assistant'});
      setMessages(prev=>[...prev,{role:'assistant',text:reply.text}]);
      if(reply.pins)onComparePins?.(reply.pins);
      if(reply.navigateTo)onNavigate?.(reply.navigateTo);
    } catch {
      setMessages(prev=>[...prev,{role:'assistant',text:'The local analysis could not complete. Try a shorter window or wait for the current scenario to finish loading.'}]);
    }

    setLoading(false);
  };

  // ── Embedded Mode ─────────────────────────────────────────
  if (embedded) {
    return (
      <div className="bento-plate flex flex-col" style={{ minHeight: 'calc(100vh - 180px)' }}>
        {/* Header */}
        <div className="p-4 border-b border-[var(--line-soft)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[var(--paper)] border border-[var(--line)] flex items-center justify-center">
              <Bot className="w-4 h-4 text-[var(--coral)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-sm text-[var(--ink)] font-sans">Mission assistant</h2>
                <span className="telemetry-chip terrain text-[10px] py-0.5 px-1.5">
                  Local analysis
                </span>
              </div>
              <p className="text-xs text-[var(--ink-mute)] font-sans">
                Local calculations and NASA mission knowledge · no external model required
              </p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded-md text-[var(--ink-mute)] hover:text-[var(--crimson)] hover:bg-white/5 transition-colors"
              title="Clear transcript"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-5 py-6 text-center max-w-xl mx-auto">
              <div>
                <h3 className="text-sm font-medium text-[var(--ink)] font-sans mb-1">
                  How can I assist your mission planning?
                </h3>
                <p className="text-xs text-[var(--ink-mute)] font-sans leading-relaxed">
                  Ask about solar grazing angles, line-of-sight communication with NASA DSN,
                  topographic relief from LOLA altimetry, or candidate landing site parameters.
                </p>
              </div>

              <div className="space-y-2 text-left">
                <div className="text-[11px] font-mono text-[var(--ink-faint)] text-center">
                  Recommended inquiries
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-left p-2.5 rounded-md bg-[var(--paper)] border border-[var(--line-soft)] text-xs text-[var(--ink-soft)] hover:border-[var(--coral)] hover:text-white transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-xl text-xs leading-relaxed font-sans ${
                  m.role === 'user'
                    ? 'bg-[rgba(255,171,94,0.12)] border border-[rgba(255,171,94,0.3)] text-[var(--ink)]'
                    : 'bg-[var(--paper-dark)] border border-[var(--line-soft)] text-[var(--ink-soft)]'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-[var(--coral)] font-mono">
                    <Bot className="w-3 h-3" /> Awilix Assistant
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[var(--paper-dark)] border border-[var(--line-soft)] rounded-xl px-4 py-3 text-xs text-[var(--ink-mute)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[var(--coral)] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[var(--coral)] rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-[var(--coral)] rounded-full animate-bounce [animation-delay:300ms]" />
                <span>Formulating response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[var(--line-soft)] bg-[var(--paper-dark)]">
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Ask mission assistant"
              maxLength={1200}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask about the project or a landing delay…"
              className="flex-1 bg-[var(--bone)] border border-[var(--line)] rounded-xl px-4 py-2.5 text-xs text-[var(--ink)] placeholder-[var(--ink-faint)] focus:outline-none focus:border-[var(--coral)]"
            />
            <button
              aria-label="Send mission question"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="btn-primary text-xs py-2 px-4 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Floating Button Mode ──────────────────────────────────
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 bg-[var(--coral)] text-[#120e07] cursor-pointer"
        title="Open Lunar Mission Assistant"
      >
        {isOpen ? <X className="w-5 h-5 text-[#120e07]" /> : <MessageCircle className="w-5 h-5 text-[#120e07]" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-h-[520px] bento-plate flex flex-col overflow-hidden shadow-2xl animate-fade-in">
          <div className="px-4 py-3 border-b border-[var(--line-soft)] flex items-center justify-between bg-[var(--paper-dark)]">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[var(--coral)]" />
              <span className="text-xs font-bold text-[var(--ink)] font-sans">Awilix Mission Assistant</span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[var(--ink-mute)] hover:text-[var(--crimson)]"
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3" style={{ maxHeight: 360 }}>
            {messages.length === 0 && (
              <div className="space-y-3 py-2 text-center">
                <p className="text-xs text-[var(--ink-mute)]">
                  Ask anything about the Moon or candidate sites!
                </p>
                {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="w-full text-left p-2.5 rounded-lg bg-[var(--paper-dark)] border border-[var(--line-soft)] text-[11px] text-[var(--ink-soft)] hover:text-white hover:border-[var(--coral)] transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-xs p-3 rounded-xl leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[rgba(255,171,94,0.15)] text-[var(--ink)] ml-6'
                    : 'bg-[var(--paper-dark)] text-[var(--ink-soft)] mr-4 border border-[var(--line-soft)]'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}

            {loading && (
              <div className="text-xs text-[var(--ink-mute)] flex items-center gap-1.5 p-2">
                <span className="w-1.5 h-1.5 bg-[var(--coral)] rounded-full animate-bounce" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-[var(--line-soft)] bg-[var(--paper-dark)] flex gap-2">
            <input
              type="text"
              aria-label="Ask mission assistant"
              maxLength={1200}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask Awilix..."
              className="flex-1 bg-[var(--bone)] border border-[var(--line)] rounded-lg px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--coral)]"
            />
            <button
              aria-label="Send mission question"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="btn-primary text-xs py-1.5 px-3"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
