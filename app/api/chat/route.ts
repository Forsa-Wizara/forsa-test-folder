import { streamText, UIMessage, convertToModelMessages, tool } from 'ai';
import { z } from 'zod';
import { createDeepSeek } from '@ai-sdk/deepseek';

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: "https://api.modelarts-maas.com/v2",
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  }
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
    console.log('API KEY USED:', process.env.DEEPSEEK_API_KEY);
  const result = streamText({
    model: deepseek('deepseek-v3.1'),
    messages: convertToModelMessages(messages),
    tools: {
      weather: tool({
        description: 'Get the weather in a location (fahrenheit)',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => {
          const temperature = Math.round(Math.random() * (90 - 32) + 32);
          return {
            location,
            temperature,
          };
        },
      }),
    },
  });

  for await (const textPart of messages) {
  console.log(textPart);
}

  return result.toUIMessageStreamResponse();
}