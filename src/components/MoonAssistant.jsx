// src/components/MoonAssistant.jsx
// AI-powered educational chatbot using Gemini 2.0 Flash
// Supports both floating FAB mode and full embedded mode

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Trash2, MessageCircle } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  "Why is the Moon's south pole important for NASA?",
  "What is a permanently shadowed region (PSR)?",
  "How does solar power work at the lunar south pole?",
  "What is Direct-to-Earth communication?",
  "Why does Earth appear to hover near the horizon from the south pole?",
  "What is lunar libration and how does it affect Earth visibility?",
  "How cold are the permanently shadowed craters?",
  "What is the significance of water ice on the Moon?",
];

export default function MoonAssistant({ site, date, power, comm, embedded = false }) {
  const [isOpen, setIsOpen] = useState(embedded);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '🔑 **API Key Required**\n\nThe Moon Assistant needs a Gemini API key to function.\n\n1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)\n2. Create a `.env` file in the project root\n3. Add: `VITE_GEMINI_API_KEY=your_key_here`\n4. Restart the dev server\n\nIn the meantime, explore the site data — all scientific computations work without an API key!',
        },
      ]);
      setLoading(false);
      return;
    }

    const systemPrompt = `You are the Moon Assistant, an enthusiastic and knowledgeable AI educator for the Lunar Landing Site Navigator — a tool built for NASA's 2026 Space Apps Challenge.

Your personality: Friendly, passionate about space exploration, encouraging curiosity. Use analogies and vivid descriptions. Keep responses concise (2-4 paragraphs max) but information-dense.

Current context that you can reference:
- Selected site: ${site?.name || 'None'} at latitude ${site?.lat || 0}°, longitude ${site?.lon || 0}°
- Mission: ${site?.mission || 'Unknown'}
- Current date: ${date}
- Solar conditions: Sun above horizon for ${power?.hours || 0} hours in the next 24h, average altitude ${power?.avgAlt?.toFixed(1) || 0}°, panel efficiency ${power?.avgEfficiency || 0}%
- Communication: Earth visible for ${comm?.hours || 0} hours, availability ${comm?.availabilityPercent || 0}%
- Site info: ${site?.whyNASAChose || ''}
- Fun fact: ${site?.funFact || ''}
- Target region: ${site?.targetRegion || 'Lunar South Pole'}
- Science goals: ${site?.keyScienceGoals?.join(', ') || 'Unknown'}

Rules:
- Always relate answers to the current site context when relevant
- Cite real NASA missions, instruments, and data when possible
- If asked about ephemeris accuracy, mention our NASA DE421 cross-validation
- Use emoji sparingly but effectively (🌙 🌍 ☀️ 🛰️)
- If unsure about something, say so honestly`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              ...messages.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.text }],
              })),
              { role: 'user', parts: [{ text: systemPrompt + '\n\nUser question: ' + userMsg }] },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800,
            },
          }),
        }
      );
      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', text: '⚠️ Error: ' + e.message }]);
    }
    setLoading(false);
  };

  // ── Embedded Full-page Mode ──
  if (embedded) {
    return (
      <div className="glass-card flex flex-col" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Header */}
        <div className="p-5 border-b border-[#1e293b] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Bot className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white">Moon Assistant</h2>
              <span className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded">
                Gemini 2.0 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Ask anything about lunar science, this site, or mission planning
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="ml-auto p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🌙</div>
                <h3 className="text-base font-semibold text-white mb-1">Welcome to the Moon Assistant</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  I'm here to help you understand lunar south pole exploration, the science behind this tool,
                  and the fascinating physics of our nearest celestial neighbor.
                </p>
              </div>

              {/* Suggested Questions */}
              <div className="max-w-lg mx-auto">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3 text-center">
                  Try asking...
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-left px-3 py-2.5 rounded-lg bg-[#111827] border border-[#1e293b] text-xs text-slate-300 hover:border-amber-400/30 hover:text-amber-300 transition-all"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400/50 inline mr-1.5" />
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
                className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-amber-400/10 border border-amber-400/20 text-white rounded-br-md'
                    : 'bg-[#111827] border border-[#1e293b] text-slate-200 rounded-bl-md'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-amber-400/60 font-mono">
                    <Bot className="w-3 h-3" /> Moon Assistant
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#111827] border border-[#1e293b] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  Thinking...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#1e293b]">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask about the Moon, this site, or lunar science..."
              className="flex-1 bg-[#0c1222] border border-[#1e293b] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/40 transition-colors"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-amber-400/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Floating FAB Mode ──
  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-5 right-5 z-50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 ${
          isOpen
            ? 'bg-[#111827] border border-[#1e293b] rotate-0'
            : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30 hover:scale-105'
        }`}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-slate-300" />
        ) : (
          <MessageCircle className="w-5 h-5 text-black" />
        )}
      </button>

      {/* Chat Popup */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-[360px] max-h-[500px] glass-card flex flex-col overflow-hidden animate-slide-in shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#1e293b] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-bold text-white">Moon Assistant</span>
              <span className="block text-[9px] text-slate-500 font-mono">Gemini 2.0 Flash</span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-1.5 rounded text-slate-600 hover:text-red-400 transition-colors"
                title="Clear"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: 340 }}>
            {messages.length === 0 && (
              <div className="space-y-2 py-2">
                <p className="text-[11px] text-slate-400 text-center">Ask about lunar science or this site!</p>
                {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#0c1222] border border-[#1e293b] text-[11px] text-slate-400 hover:border-amber-400/30 hover:text-amber-300 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-xs p-2.5 rounded-xl leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-amber-400/10 border border-amber-400/20 text-white ml-6'
                    : 'bg-[#0c1222] border border-[#1e293b] text-slate-300 mr-4'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}

            {loading && (
              <div className="text-[11px] text-slate-500 flex items-center gap-2 p-2">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#1e293b] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask about the Moon..."
              className="flex-1 bg-[#0c1222] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/40"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="px-3 py-2 rounded-lg bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 disabled:opacity-40 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}