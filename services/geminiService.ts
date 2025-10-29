
import { GoogleGenAI, Chat, GenerateContentResponse, LiveCallbacks, Modality } from "@google/genai";

// IMPORTANT: Do NOT configure an API key here. It is automatically configured by the execution environment.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses the most advanced model with "thinking mode" to analyze user's personality and skills for career suggestions.
 */
export const findCareerPath = async (prompt: string): Promise<GenerateContentResponse> => {
  const ai = getAI();
  return await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: prompt,
    config: {
      systemInstruction: "You are a world-class career counselor. Based on the user's answers, provide 3 detailed and distinct career path suggestions. For each path, explain why it's a good fit, list potential roles, describe the day-to-day, and provide a roadmap for getting started. Format the output as Markdown.",
      thinkingConfig: { thinkingBudget: 32768 }
    },
  });
};

/**
 * Uses a fast model with Google Search grounding to get real-time market data.
 */
export const getMarketData = async (career: string): Promise<GenerateContentResponse> => {
  const ai = getAI();
  return await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Provide a detailed, up-to-date analysis for a career in "${career}". Include the following:
      1.  **Salary Expectations:** Entry-level, mid-career, and senior-level, with sources.
      2.  **Job Market Outlook:** Is it growing or shrinking? What are the key trends?
      3.  **Impact of AI:** How will AI affect this career? Will it be replaced, augmented, or unchanged?
      4.  **Required Skills:** Top 5 hard and soft skills needed.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
};

/**
 * Creates a new chat session for general Q&A.
 */
export const createChatSession = (): Chat => {
  const ai = getAI();
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
        systemInstruction: 'You are a friendly and helpful career chatbot. Answer user questions concisely and accurately.'
    }
  });
};

export type QuickToolTemplate = 'resume' | 'cover-letter' | 'linkedin';

/**
 * Uses a low-latency model for quick text analysis tasks with specific templates.
 */
export const quickAnalysis = async (text: string, template: QuickToolTemplate): Promise<GenerateContentResponse> => {
    const ai = getAI();
    
    let systemPrompt = `Analyze the following text and provide 3 actionable suggestions for improvement. Keep it brief and to the point.`;

    switch (template) {
        case 'resume':
            systemPrompt = `You are a professional resume reviewer. Sharply critique the following resume section and provide 3 specific, actionable improvements for impact and clarity.`;
            break;
        case 'cover-letter':
            systemPrompt = `You are an expert hiring manager. Analyze this cover letter introduction and give 3 concrete suggestions to make it more compelling and grab the reader's attention.`;
            break;
        case 'linkedin':
            systemPrompt = `You are a LinkedIn branding specialist. Review this LinkedIn summary and provide 3 actionable tips to enhance its professional appeal and keyword optimization.`;
            break;
    }
    
    return await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: `${systemPrompt} Text: "${text}"`,
    });
};


/**
 * Connects to the Live API for real-time voice conversations.
 */
export const startLiveSession = (callbacks: LiveCallbacks) => {
    const ai = getAI();
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: 'You are a friendly and encouraging AI career coach. Keep your responses conversational and supportive. Help the user explore their career questions in a natural dialogue.'
        }
    });
};