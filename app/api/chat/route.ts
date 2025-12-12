import { streamText, stepCountIs, UIMessage, convertToModelMessages } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { SYSTEM_PROMPT } from './prompt';
import {
  // Convention tools
  searchConventions,
  checkEligibility,
  searchOffers,
  getRequiredDocuments,
  compareOffers,
  getConventionDetails,
  // Offres référentiel tools
  searchOffresRef,
  getOffreDetailsRef,
  checkOffreEligibilityRef,
  compareOffresRef,
  getOffreDocumentsRef,
  // Depot vente tools
  searchDepotsVente,
  getDepotDetailsRef,
  checkDepotEligibilityRef,
  compareDepotsRef,
  getDepotSAVRef,
} from './tools';

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: "https://api.modelarts-maas.com/v2",
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  }
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  
  try {
    const result = streamText({
      model: deepseek('deepseek-v3.1'),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      temperature: 0.3,
      stopWhen: stepCountIs(5),
      tools: {
        // Convention tools
        searchConventions,
        checkEligibility,
        searchOffers,
        getRequiredDocuments,
        compareOffers,
        getConventionDetails,
        // Offres référentiel tools
        searchOffresRef,
        getOffreDetailsRef,
        checkOffreEligibilityRef,
        compareOffresRef,
        getOffreDocumentsRef,
        // Depot vente tools
        searchDepotsVente,
        getDepotDetailsRef,
        checkDepotEligibilityRef,
        compareDepotsRef,
        getDepotSAVRef,
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Une erreur est survenue lors du traitement de votre demande.' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}