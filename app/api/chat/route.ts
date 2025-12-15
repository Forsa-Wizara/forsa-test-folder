import { streamText, generateText, stepCountIs, UIMessage, convertToModelMessages } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { SYSTEM_PROMPT } from './prompt';
import {
  // Convention tools
  queryConventions,
  checkEligibility,
  searchOffers,
  compareOffers,

  // Offres référentiel tools
  queryOffres,
  checkOffreEligibilityRef,
  compareOffresRef,

  // Depot vente tools
  queryDepots,
  checkDepotEligibilityRef,
  compareDepotsRef,
} from './tools';

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: "https://api.modelarts-maas.com/v2",
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  }
});

// System prompt pour le mode évaluation
const EVALUATION_SYSTEM_PROMPT = `Tu es un assistant expert pour Algérie Télécom.

RÈGLES POUR L'ÉVALUATION :
1. Réponds de manière DIRECTE et COMPLÈTE à chaque question
2. Ta réponse doit être AUTONOME - va directement au contenu
3. NE COMMENCE PAS par "Je recherche..." ou "Voici..."
4. Structure ta réponse en paragraphes clairs
5. Sois précis, factuel et exhaustif
6. Utilise les outils disponibles si nécessaire pour obtenir des données

${SYSTEM_PROMPT}`;

// Vérifie si c'est le format d'évaluation
function isEvaluationFormat(body: any): boolean {
  return body.equipe !== undefined && body.question !== undefined;
}

// Traite une requête d'évaluation
async function handleEvaluationRequest(body: any): Promise<Response> {
  const { equipe, question } = body;
  
  console.log('\n🚀 Starting evaluation pipeline');
  console.log(`📋 Team: ${equipe}`);
  
  // Structure de sortie
  const reponses: Record<string, Record<string, string>> = {};
  
  // Traite chaque catégorie avec index pour générer offre_01, offre_02, etc.
  const categorieIds = Object.keys(question);
  let offreIndex = 1;
  
  for (const categorieId of categorieIds) {
    const questions = question[categorieId];
    const offreKey = `offre_${String(offreIndex).padStart(2, '0')}`;
    console.log(`\n📁 Processing category: ${categorieId} → ${offreKey}`);
    
    // Initialise avec la clé offre_XX
    reponses[offreKey] = {};
    offreIndex++;
    
    // Pour chaque question dans la catégorie
    for (const [questionId, questionText] of Object.entries(questions as Record<string, string>)) {
      console.log(`\n❓ Question ${questionId}: "${questionText}"`);
      
      try {
        // Génère la réponse avec DeepSeek + outils
        const result = await generateText({
          model: deepseek('deepseek-v3.1'),
          system: EVALUATION_SYSTEM_PROMPT,
          prompt: questionText,
          temperature: 0.3,
          stopWhen: stepCountIs(15),
          tools: {
            queryConventions,
            checkEligibility,
            searchOffers,
            compareOffers,
            queryOffres,
            checkOffreEligibilityRef,
            compareOffresRef,
            queryDepots,
            checkDepotEligibilityRef,
            compareDepotsRef,
          },
        });

        const response = result.text.trim();
        reponses[offreKey][questionId] = response;
        
        console.log(`✅ Question ${questionId} completed (${response.length} chars)`);
        console.log(`📝 Preview: ${response.substring(0, 100)}...`);
        
      } catch (error) {
        console.error(`❌ Error processing question ${categorieId}/${questionId}:`, error);
        reponses[offreKey][questionId] = "Erreur lors de la génération de la réponse.";
      }
    }
  }

  // Format de sortie exact demandé
  const output = {
    equipe: equipe,
    reponses: reponses
  };

  console.log('\n✅ All questions processed successfully');
  
  return new Response(
    JSON.stringify(output, null, 2),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Traite une requête de chat classique
async function handleChatRequest(messages: UIMessage[]): Promise<Response> {
  const result = streamText({
    model: deepseek('deepseek-v3.1'),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    temperature: 0.3,
    stopWhen: stepCountIs(5),
    tools: {
      queryConventions,
      checkEligibility,
      searchOffers,
      compareOffers,
      queryOffres,
      checkOffreEligibilityRef,
      compareOffresRef,
      queryDepots,
      checkDepotEligibilityRef,
      compareDepotsRef,
    },
  });

  return result.toUIMessageStreamResponse();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Détecte le format et route vers le bon handler
    if (isEvaluationFormat(body)) {
      console.log('📊 Evaluation format detected');
      return handleEvaluationRequest(body);
    } else {
      console.log('💬 Chat format detected');
      return handleChatRequest(body.messages);
    }
    
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