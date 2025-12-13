import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { SYSTEM_PROMPT } from './prompt';
import { detectLanguage, getWaitMessage } from '@/lib/language-detector';
import { setCurrentLanguage } from '@/lib/language-context';
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

  // NGBSS tools (6 outils - procédures système de facturation)
  queryNGBSS,
  getGuideStepByStepTool,
  listAvailableGuidesTool,
  fastSearchNGBSSTool,
  searchByActionTool,
  searchByMenuTool,
} from './tools';

// ============================================================================
// CACHE DE RÉSULTATS - Améliore vitesse 2x pour requêtes fréquentes
// ============================================================================

interface CacheEntry {
  result: unknown;
  timestamp: number;
}

const toolResultCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cacheHits = 0;
let cacheMisses = 0;

function getCacheKey(toolName: string, args: unknown): string {
  return `${toolName}:${JSON.stringify(args)}`;
}

function getCachedResult(toolName: string, args: unknown): unknown | null {
  const key = getCacheKey(toolName, args);
  const entry = toolResultCache.get(key);
  
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    cacheHits++;
    console.log(`✅ Cache HIT for ${toolName} (${cacheHits}/${cacheHits + cacheMisses})`);
    return entry.result;
  }
  
  if (entry) {
    toolResultCache.delete(key); // Expired
  }
  
  cacheMisses++;
  return null;
}

function setCachedResult(toolName: string, args: unknown, result: unknown): void {
  const key = getCacheKey(toolName, args);
  toolResultCache.set(key, { result, timestamp: Date.now() });
  
  // Limite: max 200 entrées dans le cache
  if (toolResultCache.size > 200) {
    const firstKey = toolResultCache.keys().next().value;
    if (firstKey) {
      toolResultCache.delete(firstKey);
    }
  }
}

// Wrapper pour les outils AI SDK avec cache
function withCache<TParams, TResult>(toolName: string, toolDef: any): any {
  return {
    ...toolDef,
    execute: async (params: TParams) => {
      const cached = getCachedResult(toolName, params);
      if (cached !== null) {
        return cached as TResult;
      }
      
      const result = await toolDef.execute(params);
      setCachedResult(toolName, params, result);
      return result;
    }
  };
}

const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  throw new Error('DEEPSEEK_API_KEY environment variable is required');
}

// TypeScript now knows apiKey is defined
const validatedApiKey: string = apiKey;

const deepseek = createDeepSeek({
  apiKey: validatedApiKey,
  baseURL: "https://api.modelarts-maas.com/v2",
  headers: {
    'Authorization': `Bearer ${validatedApiKey}`
  }
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  
  try {
    const startTime = Date.now();
    
    // Détecte la langue du dernier message utilisateur
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    let messageText = '';
    
    // UIMessage a une structure avec parts, pas content directement
    if (lastUserMessage?.parts) {
      const textParts = lastUserMessage.parts.filter((part: any) => part.type === 'text');
      messageText = textParts.map((part: any) => part.text).join(' ');
    }
    
    const detectedLanguage = messageText ? detectLanguage(messageText) : 'fr';
    
    // Convertit 'en' en 'fr' car nous ne supportons que ar et fr
    const appLanguage: 'ar' | 'fr' = detectedLanguage === 'ar' ? 'ar' : 'fr';
    
    // Définit la langue globale pour que les fonctions de chargement l'utilisent
    setCurrentLanguage(appLanguage);
    
    // Ajoute la langue détectée au contexte système
    const languageContext = appLanguage === 'ar' 
      ? '\n\n🌐 LANGUE DÉTECTÉE: ARABE - Utilise les fichiers arConv.json, arDepot.json et arOffre.json et réponds EN ARABE.'
      : '\n\n🌐 LANGUE DÉTECTÉE: FRANÇAIS - Utilise les fichiers docs-conv.json, depot.json et offres.json et réponds EN FRANÇAIS.';
    
    console.log(`🌐 Language detected: ${detectedLanguage}`);
    
    const result = streamText({
      model: deepseek('deepseek-v3.1'),
      system: SYSTEM_PROMPT + languageContext,
      messages: convertToModelMessages(messages),
      temperature: 0.1,
      stopWhen:stepCountIs(15),
      tools: {
        // Convention tools (4) - avec cache
        queryConventions: withCache('queryConventions', queryConventions) as typeof queryConventions,
        checkEligibility: withCache('checkEligibility', checkEligibility) as typeof checkEligibility,
        searchOffers: withCache('searchOffers', searchOffers) as typeof searchOffers,
        compareOffers: withCache('compareOffers', compareOffers) as typeof compareOffers,

        // Offres référentiel tools (3) - avec cache
        queryOffres: withCache('queryOffres', queryOffres) as typeof queryOffres,
        checkOffreEligibilityRef: withCache('checkOffreEligibilityRef', checkOffreEligibilityRef) as typeof checkOffreEligibilityRef,
        compareOffresRef: withCache('compareOffresRef', compareOffresRef) as typeof compareOffresRef,

        // Depot vente tools (3) - avec cache
        queryDepots: withCache('queryDepots', queryDepots) as typeof queryDepots,
        checkDepotEligibilityRef: withCache('checkDepotEligibilityRef', checkDepotEligibilityRef) as typeof checkDepotEligibilityRef,
        compareDepotsRef: withCache('compareDepotsRef', compareDepotsRef) as typeof compareDepotsRef,

        // NGBSS tools (6) - procédures système de facturation - avec cache
        queryNGBSS: withCache('queryNGBSS', queryNGBSS) as typeof queryNGBSS,
        getGuideStepByStepTool: withCache('getGuideStepByStepTool', getGuideStepByStepTool) as typeof getGuideStepByStepTool,
        listAvailableGuidesTool: withCache('listAvailableGuidesTool', listAvailableGuidesTool) as typeof listAvailableGuidesTool,
        fastSearchNGBSSTool: withCache('fastSearchNGBSSTool', fastSearchNGBSSTool) as typeof fastSearchNGBSSTool,
        searchByActionTool: withCache('searchByActionTool', searchByActionTool) as typeof searchByActionTool,
        searchByMenuTool: withCache('searchByMenuTool', searchByMenuTool) as typeof searchByMenuTool,
      },
      onFinish: () => {
        const duration = Date.now() - startTime;
        console.log(`⚡ Request completed in ${duration}ms (cache: ${cacheHits}/${cacheHits + cacheMisses})`);
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