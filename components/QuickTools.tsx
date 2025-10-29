
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { quickAnalysis, QuickToolTemplate } from '../services/geminiService';
import { Loader } from './Loader';
import ReactMarkdown from 'react-markdown';
import { UploadIcon, LinkIcon, HistoryIcon, TrashIcon, DownloadIcon } from './Icons';

const TOOLS_HISTORY_KEY = 'careerCompassToolsHistory';

interface ToolHistoryItem {
  text: string;
  template: QuickToolTemplate;
  result: string;
  timestamp: number;
}


const QuickTools: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [template, setTemplate] = useState<QuickToolTemplate>('resume');
  const [history, setHistory] = useState<ToolHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(TOOLS_HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load tools history", e);
    }
  }, []);

  const saveHistory = (newHistory: ToolHistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem(TOOLS_HISTORY_KEY, JSON.stringify(newHistory));
  };


  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() === '') {
      setError('Please provide some text, a URL, or a file to analyze.');
      return;
    }
    setError('');
    setLoading(true);
    setResult('');
    setShowHistory(false);

    try {
      // Basic URL check
      const isUrl = text.startsWith('http://') || text.startsWith('https://');
      const contentToAnalyze = isUrl ? `Analyze the content from the following URL: ${text}` : text;
      
      const response = await quickAnalysis(contentToAnalyze, template);
      const newResult = response.text;
      setResult(newResult);
      
      const newHistoryItem: ToolHistoryItem = { text, template, result: newResult, timestamp: Date.now() };
      saveHistory([newHistoryItem, ...history]);

    } catch (err) {
      setError('An error occurred during analysis. If you used a URL, please ensure it is publicly accessible. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [text, template, history]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setText(e.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      setError("Please upload a valid .txt file.");
    }
    // Reset file input to allow uploading the same file again
    event.target.value = '';
  };

  const handleExport = () => {
    const exportText = `
# Quick Tool Analysis (${template})

**Original Text:**
\`\`\`
${text}
\`\`\`

---

**Suggestions:**
${result}
    `;
    const blob = new Blob([exportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quick-analysis-${template}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectHistory = (item: ToolHistoryItem) => {
    setText(item.text);
    setTemplate(item.template);
    setResult(item.result);
    setShowHistory(false);
  };

  const handleClearHistory = () => {
    saveHistory([]);
    setShowHistory(false);
  };


  const TemplateButton: React.FC<{ value: QuickToolTemplate; label: string }> = ({ value, label }) => (
    <button
      type="button"
      onClick={() => { setTemplate(value); setResult(''); }}
      disabled={loading}
      className={`px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 ${
        template === value ? 'bg-white text-black' : 'bg-zinc-700 hover:bg-zinc-600'
      }`}
    >
      {label}
    </button>
);

  return (
    <div className="flex flex-col h-full relative">
       <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-300">Quick Analysis Tools</h2>
        <button onClick={() => setShowHistory(!showHistory)} className="p-2 rounded-full hover:bg-zinc-700 transition">
          <HistoryIcon />
        </button>
      </div>

       {showHistory && (
        <div className="absolute top-14 right-0 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-10 p-4 animate-fade-in-down">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">Analysis History</h3>
            <button onClick={handleClearHistory} className="p-1 rounded-full hover:bg-zinc-700">
              <TrashIcon />
            </button>
          </div>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {history.length > 0 ? history.map((item) => (
              <li key={item.timestamp} onClick={() => handleSelectHistory(item)} className="p-2 rounded-md hover:bg-zinc-800 cursor-pointer">
                <p className="font-semibold text-xs capitalize text-gray-400">{item.template.replace('-', ' ')}</p>
                <p className="text-sm truncate">{item.text}</p>
                <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
              </li>
            )) : <p className="text-sm text-gray-500">No history yet.</p>}
          </ul>
        </div>
      )}

      <p className="text-gray-500 mb-2">Select a template, then paste text, a URL, or upload a file for an instant review.</p>
      <div className="flex flex-wrap gap-2 mb-4">
        <TemplateButton value="resume" label="Resume Snippet" />
        <TemplateButton value="cover-letter" label="Cover Letter Intro" />
        <TemplateButton value="linkedin" label="LinkedIn Summary" />
      </div>


      <div className="flex-grow flex flex-col">
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col">
          <div className="relative flex-grow">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-full bg-zinc-800 border border-zinc-700 rounded-md p-3 focus:ring-2 focus:ring-white focus:outline-none transition resize-none"
                placeholder={`Paste your ${template.replace('-', ' ')} text or a URL here...`}
                disabled={loading}
              />
               <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt" className="hidden" />
               <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="absolute bottom-3 right-3 p-2 rounded-full bg-zinc-700 hover:bg-zinc-600 transition" title="Upload .txt file">
                  <UploadIcon />
               </button>
          </div>
          {error && <p className="text-red-400 mt-2">{error}</p>}
          <button type="submit" disabled={loading} className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-black font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed">
            {loading ? 'Analyzing...' : 'Get Quick Feedback'}
          </button>
        </form>

        {loading && !result && (
          <div className="flex flex-col items-center justify-center text-center mt-6">
            <Loader />
            <p className="text-lg font-semibold mt-4 text-gray-300">Getting feedback...</p>
          </div>
        )}

        {result && (
          <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-gray-200">Suggestions:</h3>
                <button onClick={handleExport} className="flex items-center gap-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-1 px-3 rounded-md transition">
                    <DownloadIcon />
                    Export
                </button>
              </div>
              <div className="prose prose-invert max-w-none bg-zinc-950 p-4 rounded-lg max-h-48 overflow-y-auto">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickTools;
