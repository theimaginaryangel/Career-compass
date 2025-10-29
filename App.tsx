
import React, { useState } from 'react';
import CareerQuiz from './components/CareerQuiz';
import MarketResearch from './components/MarketResearch';
import LiveConvo from './components/LiveConvo';
import ChatBot from './components/ChatBot';
import QuickTools from './components/QuickTools';
import { CompassIcon, BriefcaseIcon, MicIcon, MessageSquareIcon, ZapIcon } from './components/Icons';

type Tab = 'quiz' | 'research' | 'live' | 'chat' | 'tools';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('quiz');

  const renderContent = () => {
    switch (activeTab) {
      case 'quiz':
        return <CareerQuiz />;
      case 'research':
        return <MarketResearch />;
      case 'live':
        return <LiveConvo />;
      case 'chat':
        return <ChatBot />;
      case 'tools':
        return <QuickTools />;
      default:
        return <CareerQuiz />;
    }
  };
  
  const NavItem: React.FC<{ tabName: Tab; icon: React.ReactNode; label: string }> = ({ tabName, icon, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 px-4 py-3 rounded-lg transition-colors duration-200 ${
        activeTab === tabName
          ? 'bg-white text-black shadow-lg'
          : 'text-gray-400 hover:bg-zinc-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans">
      <div className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white">
           Benny's Career Compass AI
          </h1>
          <p className="text-gray-500 mt-2">Your personal guide to a fulfilling career journey.</p>
        </header>

        <main className="flex flex-col lg:flex-row gap-8">
          <nav className="w-full lg:w-1/5 bg-zinc-900/50 p-4 rounded-xl shadow-2xl border border-zinc-800">
            <ul className="flex flex-row lg:flex-col gap-2 overflow-x-auto sm:overflow-visible">
              <NavItem tabName="quiz" icon={<CompassIcon />} label="Career Quiz" />
              <NavItem tabName="research" icon={<BriefcaseIcon />} label="Market Research" />
              <NavItem tabName="live" icon={<MicIcon />} label="AI Coach" />
              <NavItem tabName="chat" icon={<MessageSquareIcon />} label="Chatbot" />
              <NavItem tabName="tools" icon={<ZapIcon />} label="Quick Tools" />
            </ul>
          </nav>
          <div className="w-full lg:w-4/5 bg-zinc-900/50 p-6 md:p-8 rounded-xl shadow-2xl border border-zinc-800 min-h-[60vh]">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;