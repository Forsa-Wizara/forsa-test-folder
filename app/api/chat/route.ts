import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
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
    
    const result = streamText({
      model: deepseek('deepseek-v3.1'),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      temperature: 0.3,
      stopWhen:stepCountIs(15), // Augmenté pour workflows complexes parallèles
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