import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1',
});

// We can also create a v1-specific provider if needed, 
// though `@ai-sdk/google` often defaults to v1 or v1beta based on internal logic.
// According to latest Vercel AI SDK docs, you can specify headers or baseURL if needed,
// but usually the model names determine the version or it can be set in the constructor.
