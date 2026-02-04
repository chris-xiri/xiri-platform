import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { app } from '../firebaseConfig';
import { ArrowRight } from 'lucide-react';
import clsx from 'clsx';

const functions = getFunctions(app);
const db = getFirestore(app);

export function VendorChat() {
    const { vendorId } = useParams();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [vendorName, setVendorName] = useState("");

    // Fetch Vendor Name
    useEffect(() => {
        if (!vendorId) return;
        getDoc(doc(db, 'vendors', vendorId)).then(snap => {
            if (snap.exists()) setVendorName(snap.data().companyName);
        });
    }, [vendorId]);

    // Subscribe to Messages
    useEffect(() => {
        if (!vendorId) return;
        const q = query(collection(db, `vendors/${vendorId}/messages`), orderBy("timestamp", "asc"));
        const unsub = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [vendorId]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !vendorId) return;

        const text = inputText;
        setInputText(""); // Optimistic clear

        // Send to Backend
        const chatWithAI = httpsCallable(functions, 'chatWithAI');
        try {
            await chatWithAI({ vendorId, message: text });
        } catch (err) {
            console.error("Chat failed", err);
            alert("Failed to send message.");
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center shadow-sm z-10 transition-all">
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-gray-900">{vendorName || 'Vendor Chat'}</h1>
                    <p className="text-xs text-gray-500">Xiri AI Assistant</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 mt-10 text-sm">
                        <p>Welcome! Type "Hello" to start verification.</p>
                    </div>
                )}
                {messages.map((msg) => {
                    const isAi = msg.sender === 'ai';
                    return (
                        <div key={msg.id} className={clsx("flex", isAi ? "justify-start" : "justify-end")}>
                            <div className={clsx(
                                "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                isAi ? "bg-white text-gray-800 rounded-bl-none" : "bg-indigo-600 text-white rounded-br-none"
                            )}>
                                {msg.text}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white p-3 border-t border-gray-200">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <button type="submit" disabled={!inputText.trim()} className="bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
