import { streamText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  throw new Error('DEEPSEEK_API_KEY environment variable is required');
}

const validatedApiKey: string = apiKey;

const deepseek = createDeepSeek({
  apiKey: validatedApiKey,
  baseURL: "https://api.modelarts-maas.com/v2",
  headers: {
    'Authorization': `Bearer ${validatedApiKey}`
  }
});

// System prompt pour répondre aux questions d'évaluation
const EVALUATION_PROMPT = `Tu es un assistant expert pour Algérie Télécom.
Tu dois répondre aux questions d'évaluation de manière précise et complète en te basant sur les données disponibles.
Réponds de manière professionnelle, claire et structurée.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validation du format d'entrée
    if (!body.equipe || !body.question) {
      return new Response(
        JSON.stringify({ error: 'Format invalide. "equipe" et "question" sont requis.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { equipe, question } = body;
    
    // Structure de sortie
    const reponses: Record<string, Record<string, string>> = {};
    
    // Traite chaque catégorie
    for (const [categorieId, questions] of Object.entries(question)) {
      // Pour chaque question dans la catégorie
      for (const [questionId, questionText] of Object.entries(questions as Record<string, string>)) {
        console.log(`Processing question ${categorieId}/${questionId}: ${questionText}`);
        
        try {
          // Génère la réponse avec le modèle AI
          const result = await streamText({
            model: deepseek('deepseek-chat'),
            system: EVALUATION_PROMPT,
            messages: [
              {
                role: 'user',
                content: questionText
              }
            ],
            temperature: 0.3,
          });

          // Récupère la réponse complète
          let fullResponse = '';
          for await (const chunk of result.textStream) {
            fullResponse += chunk;
          }

          // Utilise categorieId comme nom d'offre (ou personnaliser selon besoin)
          const offreName = categorieId;
          
          if (!reponses[offreName]) {
            reponses[offreName] = {};
          }
          
          reponses[offreName][questionId] = fullResponse.trim();
          
        } catch (error) {
          console.error(`Error processing question ${categorieId}/${questionId}:`, error);
          if (!reponses[categorieId]) {
            reponses[categorieId] = {};
          }
          reponses[categorieId][questionId] = "Erreur lors de la génération de la réponse.";
        }
      }
    }

    // Format de sortie
    const output = {
      equipe,
      reponses
    };

    return new Response(
      JSON.stringify(output, null, 2),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in evaluation route:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Une erreur est survenue lors du traitement des questions.' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
