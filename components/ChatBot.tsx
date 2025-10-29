
import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { createChatSession } from '../services/geminiService';
import { Chat } from '@google/genai';
import { Loader } from './Loader';
import ReactMarkdown from 'react-markdown';
import { SendIcon, MicIcon } from './Icons';

// Fix: Add type definitions for the Web Speech API to fix TypeScript errors.
interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onend: () => void;
  onerror: (event: any) => void;
  onresult: (event: any) => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const CHAT_STORAGE_KEY = 'careerCompassChatHistory';

const ChatBot: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load chat from local storage on mount
    try {
        const savedChat = localStorage.getItem(CHAT_STORAGE_KEY);
        if (savedChat) {
            setMessages(JSON.parse(savedChat));
        } else {
            setMessages([{ role: 'model', text: 'Hello! How can I help you with your career questions today?' }]);
        }
    } catch (error) {
        console.error("Failed to load chat from local storage", error);
        setMessages([{ role: 'model', text: 'Hello! How can I help you with your career questions today?' }]);
    }
    setChat(createChatSession());
  }, []);
  
  useEffect(() => {
    // Save chat to local storage on update
    if (messages.length > 1) { // Don't save initial message
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speech recognition setup
  useEffect(() => {
    // Fix: With types defined, `(window as any)` is no longer needed.
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
        };
        recognitionRef.current = recognition;
    } else {
        console.warn("Speech Recognition API not supported in this browser.");
    }
  }, []);

  const handleMicClick = () => {
      if (isListening) {
          recognitionRef.current?.stop();
      } else {
          recognitionRef.current?.start();
      }
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chat || loading) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
        const responseStream = await chat.sendMessageStream({ message: input });
        let modelResponse = '';
        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        
        for await (const chunk of responseStream) {
            modelResponse += chunk.text;
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text = modelResponse;
                return newMessages;
            });
        }

    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-gray-300 mb-4">Career Chatbot</h2>
      <p className="text-gray-500 mb-6">Have a quick question? Ask our AI chatbot for fast answers, or use the mic to speak.</p>
      
      <div className="flex-grow bg-zinc-950 rounded-lg p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl p-3 rounded-lg prose prose-invert max-w-none ${msg.role === 'user' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-gray-300'}`}>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1].role === 'user' && (
            <div className="flex justify-start">
                 <div className="max-w-xl p-3 rounded-lg bg-zinc-800 text-gray-300">
                    <Loader />
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening..." : "Ask a question..."}
          className="flex-grow bg-zinc-800 border border-zinc-700 rounded-md p-3 focus:ring-2 focus:ring-white focus:outline-none transition"
          disabled={loading}
        />
        {recognitionRef.current && (
            <button type="button" onClick={handleMicClick} className={`p-3 rounded-md transition duration-300 ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-zinc-700 hover:bg-zinc-600 text-white'}`}>
                <MicIcon />
            </button>
        )}
        <button type="submit" disabled={loading || !input.trim()} className="bg-gray-200 hover:bg-gray-300 text-black font-bold p-3 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed">
          <SendIcon/>
        </button>
      </form>
    </div>
  );
};

export default ChatBot;