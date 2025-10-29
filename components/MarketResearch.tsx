
import React, { useState, useCallback, useEffect } from 'react';
import { getMarketData } from '../services/geminiService';
import { Loader } from './Loader';
import ReactMarkdown from 'react-markdown';
import { GroundingChunk } from "@google/genai";
import { ShareIcon, HistoryIcon, TrashIcon, DownloadIcon } from './Icons';

const RESEARCH_HISTORY_KEY = 'careerCompassResearchHistory';

interface ResearchHistoryItem {
  career: string;
  result: string;
  sources: GroundingChunk[];
  timestamp: number;
}

const MarketResearch: React.FC = () => {
  const [career, setCareer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  const [error, setError] = useState<string>('');
  const [showCopied, setShowCopied] = useState(false);
  const [history, setHistory] = useState<ResearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(RESEARCH_HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load research history", e);
    }
  }, []);

  const saveHistory = (newHistory: ResearchHistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem(RESEARCH_HISTORY_KEY, JSON.stringify(newHistory));
  };


  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (career.trim() === '') {
      setError('Please enter a career title.');
      return;
    }
    setError('');
    setLoading(true);
    setResult('');
    setSources([]);
    setShowHistory(false);

    try {
      const response = await getMarketData(career);
      const newResult = response.text;
      setResult(newResult);
      
      const metadata = response.candidates?.[0]?.groundingMetadata;
      const newSources = metadata?.groundingChunks || [];
      setSources(newSources);

      const newHistoryItem: ResearchHistoryItem = { career, result: newResult, sources: newSources, timestamp: Date.now() };
      saveHistory([newHistoryItem, ...history]);

    } catch (err) {
      setError('An error occurred while fetching market data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [career, history]);

  const handleShare = () => {
    const shareText = `Market Research for "${career}" from Career Compass AI:\n\n${result}`;
    navigator.clipboard.writeText(shareText).then(() => {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    });
  };

  const handleExport = () => {
    const exportText = `
# Market Research for: ${career}

${result}

---
**Sources:**
${sources.map(s => `- [${s.web?.title || s.web?.uri}](${s.web?.uri})`).join('\n')}
    `;
    const blob = new Blob([exportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-research-${career.replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectHistory = (item: ResearchHistoryItem) => {
    setCareer(item.career);
    setResult(item.result);
    setSources(item.sources);
    setShowHistory(false);
  };

  const handleClearHistory = () => {
    saveHistory([]);
    setShowHistory(false);
  };


  return (
    <div className="flex flex-col h-full relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-300">Real-Time Market Research</h2>
        <button onClick={() => setShowHistory(!showHistory)} className="p-2 rounded-full hover:bg-zinc-700 transition">
          <HistoryIcon />
        </button>
      </div>
      
      {showHistory && (
        <div className="absolute top-14 right-0 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-10 p-4 animate-fade-in-down">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">Research History</h3>
            <button onClick={handleClearHistory} className="p-1 rounded-full hover:bg-zinc-700">
              <TrashIcon />
            </button>
          </div>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {history.length > 0 ? history.map((item) => (
              <li key={item.timestamp} onClick={() => handleSelectHistory(item)} className="p-2 rounded-md hover:bg-zinc-800 cursor-pointer">
                <p className="font-semibold text-sm truncate">{item.career}</p>
                <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
              </li>
            )) : <p className="text-sm text-gray-500">No history yet.</p>}
          </ul>
        </div>
      )}
      
      <p className="text-gray-500 mb-6">Get the latest, AI-powered insights on any career. Data is grounded in real-time Google Search results.</p>
      
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          value={career}
          onChange={(e) => setCareer(e.target.value)}
          placeholder="e.g., 'Data Scientist' or 'UX Designer'"
          className="flex-grow bg-zinc-800 border border-zinc-700 rounded-md p-3 focus:ring-2 focus:ring-white focus:outline-none transition"
          disabled={loading}
        />
        <button type="submit" disabled={loading} className="bg-gray-200 hover:bg-gray-300 text-black font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed">
          {loading ? 'Searching...' : 'Research'}
        </button>
      </form>
      {error && <p className="text-red-400 mb-4">{error}</p>}

      <div className="flex-grow overflow-y-auto pr-2">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader />
            <p className="text-lg font-semibold mt-4 text-gray-300">Fetching Real-Time Data...</p>
          </div>
        )}
        {result && (
          <div>
            <div className="prose prose-invert prose-lg max-w-none bg-zinc-950 p-6 rounded-lg">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
            {sources.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Sources:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {sources.map((source, index) => (
                    source.web && (
                      <li key={index}>
                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:underline">
                          {source.web.title || source.web.uri}
                        </a>
                      </li>
                    )
                  ))}
                </ul>
              </div>
            )}
             <div className="mt-6 flex items-center gap-4">
                <button onClick={handleShare} className="relative flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-md transition">
                    <ShareIcon />
                    Share
                    {showCopied && <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded py-1 px-2">Copied!</span>}
                </button>
                <button onClick={handleExport} className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-md transition">
                    <DownloadIcon />
                    Export
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketResearch;
