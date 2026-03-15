import { googleAI } from '@/lib/ai-provider'
import { generateText } from 'ai'

export async function GET() {
    try {
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            console.error('AI Health Check: GOOGLE_GENERATIVE_AI_API_KEY is missing');
            return new Response('API Key Missing', { status: 500 });
        }

        // Simple test to see if Gemini API is responsive
        const { text } = await generateText({
            model: googleAI('gemini-1.5-flash'),
            prompt: 'health check respond OK',
            maxTokens: 5
        })
        
        console.log('AI Health Check Response:', text);
        if (text) return new Response('OK', { status: 200 })
        throw new Error('No response content from AI')
    } catch (e: any) {
        console.error('AI Health Check failed detailed error:', e)
        return new Response(e.message || 'Unknown Error', { status: 500 })
    }
}
