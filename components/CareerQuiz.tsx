
import React, { useState, useCallback, useEffect } from 'react';
import { findCareerPath } from '../services/geminiService';
import { Loader } from './Loader';
import ReactMarkdown from 'react-markdown';
import { ShareIcon, HistoryIcon, TrashIcon, DownloadIcon } from './Icons';

const questions = [
  "What subjects or activities did you enjoy most in school?",
  "What are your favorite hobbies or things to do in your free time?",
  "Describe your ideal work environment (e.g., collaborative, independent, fast-paced, quiet).",
  "What kind of problems do you enjoy solving?",
  "What are you naturally good at, even without much effort?",
  "If you could learn any new skill, what would it be and why?",
  "What are your long-term personal and professional goals?",
];

const QUIZ_HISTORY_KEY = 'careerCompassQuizHistory';

interface QuizHistoryItem {
  answers: string[];
  result: string;
  timestamp: number;
}

const CareerQuiz: React.FC = () => {
  const [answers, setAnswers] = useState<string[]>(Array(questions.length).fill(''));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showCopied, setShowCopied] = useState(false);
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);


  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(QUIZ_HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load quiz history", e);
    }
  }, []);

  const saveHistory = (newHistory: QuizHistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(newHistory));
  };


  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (answers.some(a => a.trim() === '')) {
      setError('Please answer all questions to get the best results.');
      return;
    }
    setError('');
    setLoading(true);
    setResult('');
    setShowHistory(false);

    const prompt = `
      Analyze the following responses to generate career path suggestions.
      ${questions.map((q, i) => `Question: ${q}\nAnswer: ${answers[i]}`).join('\n\n')}
    `;

    try {
      const response = await findCareerPath(prompt);
      const newResult = response.text;
      setResult(newResult);
      const newHistoryItem: QuizHistoryItem = { answers, result: newResult, timestamp: Date.now() };
      saveHistory([newHistoryItem, ...history]);

    } catch (err) {
      setError('An error occurred while generating your career path. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [answers, history]);

  const handleShare = () => {
    const shareText = `My AI Career Path Results from Career Compass AI:\n\n${result}`;
    navigator.clipboard.writeText(shareText).then(() => {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    });
  };

  const handleExport = () => {
    const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'career-quiz-results.md';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleSelectHistory = (item: QuizHistoryItem) => {
    setAnswers(item.answers);
    setResult(item.result);
    setShowHistory(false);
  };

  const handleClearHistory = () => {
    saveHistory([]);
    setShowHistory(false);
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-300">Deep Dive: The Thinking Career Quiz</h2>
        <button onClick={() => setShowHistory(!showHistory)} className="p-2 rounded-full hover:bg-zinc-700 transition">
          <HistoryIcon />
        </button>
      </div>

       {showHistory && (
        <div className="absolute top-14 right-0 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-10 p-4 animate-fade-in-down">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">Quiz History</h3>
            <button onClick={handleClearHistory} className="p-1 rounded-full hover:bg-zinc-700">
              <TrashIcon />
            </button>
          </div>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {history.length > 0 ? history.map((item) => (
              <li key={item.timestamp} onClick={() => handleSelectHistory(item)} className="p-2 rounded-md hover:bg-zinc-800 cursor-pointer">
                <p className="text-sm truncate">{item.answers.join(' ').substring(0, 50)}...</p>
                <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
              </li>
            )) : <p className="text-sm text-gray-500">No history yet.</p>}
          </ul>
        </div>
      )}

      <p className="text-gray-500 mb-6">Answer these questions thoughtfully. Our most powerful AI will analyze your responses to suggest detailed career paths tailored just for you.</p>

      {!result && !loading && (
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-2 flex-grow">
          {questions.map((q, i) => (
            <div key={i}>
              <label className="block text-gray-300 font-medium mb-2">{q}</label>
              <textarea
                value={answers[i]}
                onChange={(e) => handleAnswerChange(i, e.target.value)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-3 focus:ring-2 focus:ring-white focus:outline-none transition"
                placeholder="Your thoughts..."
              />
            </div>
          ))}
          {error && <p className="text-red-400">{error}</p>}
          <div className="pt-4">
            <button type="submit" disabled={loading} className="w-full bg-gray-200 hover:bg-gray-300 text-black font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed">
              {loading ? 'Analyzing...' : 'Find My Career Path'}
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center flex-grow text-center">
          <Loader />
          <p className="text-lg font-semibold mt-4 text-gray-300">Engaging Thinking Mode...</p>
          <p className="text-gray-500">Our AI is deeply analyzing your profile. This may take a moment.</p>
        </div>
      )}

      {result && (
        <div className="flex flex-col flex-grow">
          <div className="prose prose-invert prose-lg max-w-none overflow-y-auto pr-2 flex-grow bg-zinc-950 p-6 rounded-lg">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
           <div className="flex items-center gap-4 mt-4">
              <button onClick={() => { setResult(''); setAnswers(Array(questions.length).fill('')); }} className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-md transition">
                Start Over
              </button>
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
  );
};

export default CareerQuiz;
