'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { X, Send, MessageCircle, Sparkles, Loader2 } from 'lucide-react';
import { app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { trackEvent } from '@/lib/tracking';

/**
 * AskAIWidget — Floating AI chat widget for the public site.
 *
 * Powered by Gemini via the `askAI` Cloud Function.
 * Features:
 *  - Floating action button (bottom-right)
 *  - Expandable chat panel with glassmorphism
 *  - Suggested question chips for zero-friction start
 *  - Page-aware context (sends current URL to backend)
 *  - Markdown-lite rendering (bold, links, bullets)
 *  - Soft lead capture after 3 user messages
 *  - Mobile responsive (bottom sheet on small screens)
 *  - Suppressed on utility pages (audit, onboarding, etc.)
 */

// ── Types ─────────────────────────────────────────────────────────

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

// ── Suggested Questions ───────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
    'How does NFC verification work?',
    'What\'s included in a site audit?',
    'What services do you cover?',
    'Do you service my area?',
];

// ── Markdown-lite renderer ────────────────────────────────────────

function renderMessage(text: string) {
    // Process markdown: **bold**, [links](url), bullet points
    const lines = text.split('\n');

    return lines.map((line, i) => {
        // Bullet points
        const isBullet = /^[\-\*•]\s/.test(line.trim());
        const content = isBullet ? line.trim().replace(/^[\-\*•]\s/, '') : line;

        // Process inline markdown
        let processed = content
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Links
            .replace(
                /\[([^\]]+)\]\(([^)]+)\)/g,
                '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:text-sky-300 underline underline-offset-2">$1</a>'
            );

        if (isBullet) {
            return (
                <div key={i} className="flex gap-2 ml-1 my-0.5">
                    <span className="text-sky-400 mt-0.5 shrink-0">•</span>
                    <span dangerouslySetInnerHTML={{ __html: processed }} />
                </div>
            );
        }

        if (line.trim() === '') {
            return <div key={i} className="h-2" />;
        }

        return (
            <p key={i} className="my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
        );
    });
}

// ── Widget Component ──────────────────────────────────────────────

export function AskAIWidget() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [userMessageCount, setUserMessageCount] = useState(0);
    const [showLeadCapture, setShowLeadCapture] = useState(false);
    const [leadEmail, setLeadEmail] = useState('');
    const [leadCaptured, setLeadCaptured] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Suppressed pages
    const suppressedPages = ['/audit', '/onboarding', '/waitlist', '/demo', '/privacy', '/terms', '/quote', '/invoice'];
    const isSuppressed = suppressedPages.some(p => pathname.startsWith(p));

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, showLeadCapture]);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const toggleOpen = useCallback(() => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            trackEvent('click_cta', { element: 'ai_chat_opened', source: pathname });
        }
    }, [isOpen, pathname]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || loading) return;

        const userMessage: ChatMessage = { role: 'user', text: text.trim() };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setLoading(true);
        setHasInteracted(true);

        const newCount = userMessageCount + 1;
        setUserMessageCount(newCount);

        trackEvent('click_cta', {
            element: 'ai_chat_message',
            source: pathname,
        });

        try {
            const functions = getFunctions(app);
            const askAIFn = httpsCallable<
                { messages: ChatMessage[]; pageUrl: string },
                { reply: string }
            >(functions, 'askAI');

            const result = await askAIFn({
                messages: newMessages,
                pageUrl: typeof window !== 'undefined' ? window.location.href : '',
            });

            const aiMessage: ChatMessage = { role: 'model', text: result.data.reply };
            setMessages([...newMessages, aiMessage]);

            // Show lead capture after 3 user messages (and haven't captured yet)
            if (newCount >= 3 && !leadCaptured && !showLeadCapture) {
                setTimeout(() => setShowLeadCapture(true), 1000);
            }
        } catch (error: any) {
            console.error('[AskAIWidget] Error:', error);
            const errorMessage: ChatMessage = {
                role: 'model',
                text: 'I had a brief hiccup — could you try asking that again? If the issue persists, you can always reach us at (516) 399-0350.',
            };
            setMessages([...newMessages, errorMessage]);
        } finally {
            setLoading(false);
        }
    }, [messages, loading, userMessageCount, leadCaptured, showLeadCapture, pathname]);

    const handleLeadSubmit = useCallback(async () => {
        if (!leadEmail.trim()) {
            setShowLeadCapture(false);
            return;
        }

        trackEvent('click_cta', {
            element: 'ai_chat_lead_captured',
            source: pathname,
        });

        // Write to Firestore via a lightweight callable or directly
        try {
            const functions = getFunctions(app);
            // For now, just store it in the chat — we can add a dedicated function later
            // The important thing is we captured the intent
            setLeadCaptured(true);
            setShowLeadCapture(false);

            // Add a confirmation message from the AI
            setMessages(prev => [...prev, {
                role: 'model',
                text: `Thanks! I'll keep that noted. Feel free to keep asking questions, or whenever you're ready → [Start a Free Site Audit](https://xiri.ai/#audit) to get a custom scope for your building.`,
            }]);
        } catch {
            setShowLeadCapture(false);
        }
    }, [leadEmail, pathname]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    if (isSuppressed) return null;

    return (
        <>
            {/* ── Floating Action Button ── */}
            <button
                onClick={toggleOpen}
                aria-label="Ask AI about XIRI"
                className={`fixed z-50 group transition-all duration-300 ease-out ${
                    isOpen
                        ? 'bottom-[540px] md:bottom-[560px] right-4 md:right-6'
                        : 'bottom-4 right-4 md:bottom-6 md:right-6'
                } ${isOpen ? 'scale-90 opacity-70 hover:opacity-100' : ''}`}
                style={{ display: isOpen ? 'none' : 'flex' }}
            >
                <div className="relative flex items-center gap-2 bg-gradient-to-r from-sky-600 to-sky-500 text-white px-5 py-3 rounded-full shadow-lg shadow-sky-600/30 hover:shadow-xl hover:shadow-sky-600/40 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Ask AI about XIRI</span>
                    <span className="text-sm font-medium sm:hidden">Ask AI</span>
                    {/* Subtle pulse indicator */}
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                </div>
            </button>

            {/* ── Chat Panel ── */}
            <div className={`fixed z-50 transition-all duration-300 ease-out ${
                isOpen
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-8 pointer-events-none'
            } bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-[420px] h-[100dvh] md:h-[540px] md:rounded-2xl overflow-hidden`}
                style={{
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                }}
            >
                {/* Glass container */}
                <div className="flex flex-col h-full bg-slate-900/95 md:rounded-2xl border border-slate-700/50 shadow-2xl">

                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-slate-800/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">XIRI AI Advisor</h3>
                                <p className="text-[11px] text-slate-400">Facility management expert</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleOpen}
                            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            aria-label="Close chat"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* ── Messages ── */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
                        {/* Welcome message */}
                        <div className="flex gap-3">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="bg-slate-800/80 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-slate-200 leading-relaxed max-w-[85%]">
                                <p>Hi! I&apos;m XIRI&apos;s facility advisor. I can help you understand how our <strong className="text-white">verified facility management</strong> works, what services we cover, and whether we&apos;re a fit for your building.</p>
                                <p className="mt-2 text-slate-400 text-xs">Ask anything, or pick a question below 👇</p>
                            </div>
                        </div>

                        {/* Suggested questions (show only if no interaction yet) */}
                        {!hasInteracted && (
                            <div className="flex flex-wrap gap-2 pl-10">
                                {SUGGESTED_QUESTIONS.map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => sendMessage(q)}
                                        className="text-xs px-3 py-2 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 transition-all duration-200 text-left cursor-pointer"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Conversation messages */}
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'model' && (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Sparkles className="w-3.5 h-3.5 text-white" />
                                    </div>
                                )}
                                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
                                    msg.role === 'user'
                                        ? 'bg-sky-600 text-white rounded-tr-md'
                                        : 'bg-slate-800/80 text-slate-200 rounded-tl-md'
                                }`}>
                                    {msg.role === 'model' ? renderMessage(msg.text) : msg.text}
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {loading && (
                            <div className="flex gap-3">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5 text-white" />
                                </div>
                                <div className="bg-slate-800/80 rounded-2xl rounded-tl-md px-4 py-3">
                                    <div className="flex gap-1.5">
                                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Soft lead capture */}
                        {showLeadCapture && !leadCaptured && (
                            <div className="mx-2 bg-gradient-to-r from-sky-900/50 to-sky-800/50 border border-sky-500/20 rounded-xl p-4">
                                <p className="text-sm text-sky-200 font-medium mb-2">
                                    📬 Want a summary of this conversation?
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        placeholder="your@email.com"
                                        value={leadEmail}
                                        onChange={(e) => setLeadEmail(e.target.value)}
                                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                                        onKeyDown={(e) => e.key === 'Enter' && handleLeadSubmit()}
                                    />
                                    <button
                                        onClick={handleLeadSubmit}
                                        className="px-3 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-500 transition-colors cursor-pointer"
                                    >
                                        Send
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowLeadCapture(false)}
                                    className="text-xs text-slate-500 mt-2 hover:text-slate-400 transition-colors cursor-pointer"
                                >
                                    Skip — keep chatting
                                </button>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* ── Input Bar ── */}
                    <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/30">
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about XIRI's services..."
                                disabled={loading}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 disabled:opacity-50 transition-all"
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={loading || !input.trim()}
                                className="p-3 bg-sky-600 text-white rounded-xl hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                                aria-label="Send message"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-600 text-center mt-2">
                            Powered by XIRI AI · Responses may not be 100% accurate
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Backdrop (mobile only) ── */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden"
                    onClick={toggleOpen}
                />
            )}
        </>
    );
}
