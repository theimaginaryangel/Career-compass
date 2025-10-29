
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { startLiveSession } from '../services/geminiService';
import { LiveServerMessage } from '@google/genai';
import { MicIcon, MicOffIcon, AlertTriangleIcon, StopIcon } from './Icons';

const LIVE_CONVO_STORAGE_KEY = 'careerCompassLiveConvoHistory';
type AIStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

// Helper functions for audio encoding/decoding
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};


const encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

interface Transcription {
    author: 'You' | 'AI';
    text: string;
}

const StatusIndicator: React.FC<{ status: AIStatus; error: string | null }> = ({ status, error }) => {
    switch (status) {
        case 'connecting':
            return <p className="text-center text-gray-400">Connecting to AI Coach...</p>;
        case 'listening':
            return <p className="text-center text-green-400 flex items-center justify-center gap-2">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Listening...
            </p>;
        case 'thinking':
            return <p className="text-center text-gray-400 animate-pulse">AI is thinking...</p>;
        case 'speaking':
            return <p className="text-center text-gray-300 animate-pulse">AI is speaking...</p>;
        case 'error':
            return <div className="flex items-center justify-center gap-2 text-red-400"><AlertTriangleIcon/> <p>{error}</p></div>;
        case 'idle':
        default:
            return <p className="text-center text-zinc-600">Press the microphone to start.</p>;
    }
};

const LiveConvo: React.FC = () => {
    const [aiStatus, setAIStatus] = useState<AIStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [transcription, setTranscription] = useState<Transcription[]>([]);

    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const sessionPromiseRef = useRef<ReturnType<typeof startLiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const nextStartTimeRef = useRef(0);
    const aiSpeakingTimerRef = useRef<number | null>(null);


    const cleanup = useCallback(() => {
        if (aiSpeakingTimerRef.current) clearTimeout(aiSpeakingTimerRef.current);
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if(scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        setAIStatus('idle');
    }, []);

    const startConversation = async () => {
        setAIStatus('connecting');
        setError(null);
        setTranscription([]);
        nextStartTimeRef.current = 0;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            sessionPromiseRef.current = startLiveSession({
                onopen: () => {
                    setAIStatus('listening');
                    const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob = {
                            data: encode(new Uint8Array(int16.buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                    }
                    if (message.serverContent?.outputTranscription) {
                        currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                    }
                    if (message.serverContent?.turnComplete) {
                        const userInput = currentInputTranscriptionRef.current.trim();
                        const aiOutput = currentOutputTranscriptionRef.current.trim();
                         setTranscription(prev => {
                            const newHistory = [...prev];
                            if(userInput) newHistory.push({author: 'You', text: userInput});
                            if(aiOutput) newHistory.push({author: 'AI', text: aiOutput});
                            return newHistory;
                        });
                        currentInputTranscriptionRef.current = '';
                        currentOutputTranscriptionRef.current = '';
                        setAIStatus('thinking');
                    }

                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData && outputAudioContextRef.current) {
                        setAIStatus('speaking');
                        if (aiSpeakingTimerRef.current) clearTimeout(aiSpeakingTimerRef.current);
                        
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                        const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContextRef.current.destination);
                        source.addEventListener('ended', () => {
                          sourcesRef.current.delete(source);
                        });
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                        
                        aiSpeakingTimerRef.current = window.setTimeout(() => {
                           setAIStatus('listening');
                        }, audioBuffer.duration * 1000);
                    }
                    
                    if (message.serverContent?.interrupted) {
                        if (aiSpeakingTimerRef.current) clearTimeout(aiSpeakingTimerRef.current);
                        for (const source of sourcesRef.current.values()) source.stop();
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                        setAIStatus('listening');
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Live session error:', e);
                    setError('A connection error occurred. Please try again.');
                    setAIStatus('error');
                    cleanup();
                },
                onclose: () => {
                    cleanup();
                },
            });
        } catch (err) {
            console.error('Failed to start conversation:', err);
            setError('Could not access microphone. Please grant permission and try again.');
            setAIStatus('error');
            cleanup();
        }
    };
    
    useEffect(() => {
        try {
            const saved = localStorage.getItem(LIVE_CONVO_STORAGE_KEY);
            if(saved) setTranscription(JSON.parse(saved));
        } catch(e) {
            console.error("Failed to load transcription", e);
        }
        return () => cleanup();
    }, [cleanup]);

    useEffect(() => {
        if(transcription.length > 0) {
            localStorage.setItem(LIVE_CONVO_STORAGE_KEY, JSON.stringify(transcription));
        }
    }, [transcription]);

    const isSessionActive = aiStatus !== 'idle' && aiStatus !== 'error' && aiStatus !== 'connecting';
    
    const handleInterruptSpeech = useCallback(() => {
        if (aiSpeakingTimerRef.current) {
            clearTimeout(aiSpeakingTimerRef.current);
            aiSpeakingTimerRef.current = null;
        }
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setAIStatus('listening');
    }, []);

    const handleControlButtonClick = () => {
        if (aiStatus === 'speaking') {
            handleInterruptSpeech();
        } else if (isSessionActive) {
            cleanup();
        } else {
            startConversation();
        }
    };
    
    const getButtonIcon = () => {
        if (aiStatus === 'connecting') {
            return <div className="w-8 h-8 border-4 border-t-transparent border-white rounded-full animate-spin"></div>;
        }
        if (aiStatus === 'speaking') {
            return <StopIcon />;
        }
        if (isSessionActive) { // Covers listening, thinking
            return <MicOffIcon />;
        }
        return <MicIcon />;
    };


    return (
        <div className="flex flex-col h-full">
            <h2 className="text-2xl font-bold text-gray-300 mb-4">Conversational AI Coach</h2>
            <p className="text-gray-500 mb-6">Talk with your AI career coach in real-time. Ask questions, explore ideas, and practice interviews.</p>
            
            <div className="flex items-center justify-center mb-4 h-8">
              <StatusIndicator status={aiStatus} error={error}/>
            </div>

            <div className="flex items-center justify-center mb-6">
                <button
                    onClick={handleControlButtonClick}
                    disabled={aiStatus === 'connecting'}
                    className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 ${
                        isSessionActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-black'
                    } shadow-lg disabled:bg-gray-600 disabled:cursor-wait`}
                >
                    {isSessionActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                    {getButtonIcon()}
                </button>
            </div>

            <div className="flex-grow bg-zinc-950 rounded-lg p-4 overflow-y-auto space-y-4">
                {transcription.length === 0 && aiStatus === 'idle' && (
                     <div className="text-center text-zinc-600 pt-8">Your conversation history will appear here.</div>
                )}
                {transcription.map((entry, index) => (
                    entry.text && <div key={index} className={`flex ${entry.author === 'You' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xl p-3 rounded-lg ${entry.author === 'You' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-gray-300'}`}>
                            <p className="font-bold text-sm mb-1">{entry.author}</p>
                            <p>{entry.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LiveConvo;