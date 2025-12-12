import { z } from 'zod';
import { prisma } from './prisma';
import { memoizeLRU, createSearchKey } from './cache-utils';

// ============================================================================
// ZOD SCHEMAS & TYPES
// ============================================================================

export const EligibilitySchema = z.object({
  active: z.boolean().optional(),
  retired: z.boolean().optional(),
  family: z.boolean().optional(),
  family_details: z.string().optional(),
  subsidiaries: z.boolean().optional(),
  widows_invalids: z.boolean().optional(),
  second_access: z.boolean().optional(),
  second_access_condition: z.string().optional(),
  hierarchical: z.boolean().optional(),
  civil: z.boolean().optional(),
  adherents: z.boolean().optional(),
  conditions: z.array(z.string()).optional(),
  details: z.string().optional(),
});

export const OfferSchema = z.object({
  category: z.enum(['INTERNET', 'TELEPHONY', '4G', 'HARDWARE', 'EMAIL', 'E-LEARNING']),
  technology: z.string().optional(),
  speed_mbps: z.number().optional(),
  plan: z.string().optional(),
  volume_go: z.number().optional(),
  frequency: z.string().optional(),
  product: z.string().optional(),
  type: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  price_convention_da: z.number(),
  price_public_da: z.number().optional(),
  discount: z.string().optional(),
  condition: z.string().optional(),
  label: z.string().optional(),
  note: z.string().optional(),
});

export const ConventionSchema = z.object({
  convention_id: z.string(),
  partner_name: z.string(),
  aliases: z.array(z.string()),
  client_type: z.enum(['B2C', 'B2B']),
  eligibility: EligibilitySchema,
  documents: z.array(z.string()),
  offers: z.array(OfferSchema),
  notes: z.string().optional(),
  store_items: z.array(z.any()).optional(),
});

export type Eligibility = z.infer<typeof EligibilitySchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type Convention = z.infer<typeof ConventionSchema>;

// ============================================================================
// CACHE SINGLETON WITH INDEXES
// ============================================================================

let conventionsCache: Convention[] | null = null;
let indexById: Map<string, Convention> | null = null;
let indexByCategory: Map<string, Array<{ convention: Convention; offer: Offer }>> | null = null;
let indexByTechnology: Map<string, Array<{ convention: Convention; offer: Offer }>> | null = null;
let indexByPriceRange: Map<string, Array<{ convention: Convention; offer: Offer }>> | null = null;
let normalizedSearchTerms: Map<string, Convention[]> | null = null;

/**
 * Build all indexes for O(1) and optimized lookups
 */
function buildIndexes(conventions: Convention[]): void {
  indexById = new Map();
  indexByCategory = new Map();
  indexByTechnology = new Map();
  indexByPriceRange = new Map();
  normalizedSearchTerms = new Map();
  
  for (const convention of conventions) {
    // Index by ID - O(1) lookup
    indexById.set(convention.convention_id, convention);
    
    // Build normalized search terms (partner name + aliases)
    const searchTerms = [convention.partner_name.toLowerCase(), ...convention.aliases.map(a => a.toLowerCase())];
    for (const term of searchTerms) {
      if (!normalizedSearchTerms.has(term)) {
        normalizedSearchTerms.set(term, []);
      }
      normalizedSearchTerms.get(term)!.push(convention);
    }
    
    // Index each offer
    for (const offer of convention.offers) {
      const item = { convention, offer };
      
      // Index by category
      if (!indexByCategory.has(offer.category)) {
        indexByCategory.set(offer.category, []);
      }
      indexByCategory.get(offer.category)!.push(item);
      
      // Index by technology
      if (offer.technology) {
        const techs = normalizeTechnology(offer.technology);
        for (const tech of techs) {
          if (!indexByTechnology.has(tech)) {
            indexByTechnology.set(tech, []);
          }
          indexByTechnology.get(tech)!.push(item);
        }
      }
      
      // Index by price ranges (0-1000, 1000-2000, 2000-5000, 5000+)
      const price = offer.price_convention_da;
      let priceRange: string;
      if (price < 1000) priceRange = '0-1000';
      else if (price < 2000) priceRange = '1000-2000';
      else if (price < 5000) priceRange = '2000-5000';
      else priceRange = '5000+';
      
      if (!indexByPriceRange.has(priceRange)) {
        indexByPriceRange.set(priceRange, []);
      }
      indexByPriceRange.get(priceRange)!.push(item);
    }
  }
}

/**
 * Load conventions from database with Prisma
 */
export async function loadConventions(): Promise<Convention[]> {
  if (conventionsCache !== null) {
    return conventionsCache;
  }

  try {
    const dbConventions = await prisma.convention.findMany({
      include: {
        eligibility: true,
        offers: true,
      },
    });
    
    // Transform database format to application format
    const conventions: Convention[] = dbConventions.map(conv => ({
      convention_id: conv.conventionId,
      partner_name: conv.partnerName,
      aliases: JSON.parse(conv.aliases),
      client_type: conv.clientType as 'B2C' | 'B2B',
      eligibility: {
        active: conv.eligibility?.active ?? false,
        retired: conv.eligibility?.retired ?? false,
        family: conv.eligibility?.family ?? false,
        family_details: conv.eligibility?.familyDetails ?? undefined,
        subsidiaries: conv.eligibility?.subsidiaries ?? false,
        widows_invalids: conv.eligibility?.widowsInvalids ?? false,
        second_access: conv.eligibility?.secondAccess ?? false,
        second_access_condition: conv.eligibility?.secondAccessCondition ?? undefined,
        hierarchical: conv.eligibility?.hierarchical ?? false,
        civil: conv.eligibility?.civil ?? false,
        adherents: conv.eligibility?.adherents ?? false,
        conditions: conv.eligibility?.conditions ? JSON.parse(conv.eligibility.conditions) : undefined,
        details: conv.eligibility?.details ?? undefined,
      },
      documents: JSON.parse(conv.documents),
      offers: conv.offers.map(offer => ({
        category: offer.category as Offer['category'],
        technology: offer.technology ?? undefined,
        speed_mbps: offer.speedMbps ?? undefined,
        plan: offer.plan ?? undefined,
        volume_go: offer.volumeGo ?? undefined,
        frequency: offer.frequency ?? undefined,
        product: offer.product ?? undefined,
        type: offer.type ?? undefined,
        model: offer.model ?? undefined,
        provider: offer.provider ?? undefined,
        price_convention_da: offer.priceConventionDa,
        price_public_da: offer.pricePublicDa ?? undefined,
        discount: offer.discount ?? undefined,
        condition: offer.condition ?? undefined,
        label: offer.label ?? undefined,
        note: offer.note ?? undefined,
      })),
      notes: conv.notes ?? undefined,
    }));
    
    conventionsCache = conventions;
    
    // Build indexes for fast lookups
    buildIndexes(conventions);
    
    console.log(`✅ Loaded ${conventions.length} conventions from database with optimized indexes`);
    return conventions;
  } catch (error) {
    console.error('❌ Error loading conventions:', error);
    throw new Error('Failed to load conventions data');
  }
}

/**
 * Clear cache (useful for testing or reloading)
 */
export function clearCache(): void {
  conventionsCache = null;
  indexById = null;
  indexByCategory = null;
  indexByTechnology = null;
  indexByPriceRange = null;
  normalizedSearchTerms = null;
}

// ============================================================================
// FUZZY MATCHING (LEVENSHTEIN DISTANCE)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[s2.length][s1.length];
}

/**
 * Fuzzy match a search term against a target string
 * @param search - User input string
 * @param target - String to match against
 * @param threshold - Maximum edit distance (default: 3)
 */
export function fuzzyMatch(search: string, target: string, threshold: number = 3): boolean {
  const searchLower = search.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();
  
  // Exact match
  if (targetLower.includes(searchLower)) {
    return true;
  }
  
  // Levenshtein distance check
  const distance = levenshteinDistance(searchLower, targetLower);
  return distance <= threshold;
}

/**
 * Find conventions by fuzzy matching partner name or aliases - MEMOIZED
 */
const _fuzzyMatchConvention = (search: string, conventions: Convention[]): Convention[] => {
  const matches: Array<{ convention: Convention; score: number }> = [];
  
  for (const conv of conventions) {
    let bestScore = Infinity;
    
    // Check partner name
    const nameDistance = levenshteinDistance(search, conv.partner_name);
    if (nameDistance < bestScore) {
      bestScore = nameDistance;
    }
    
    // Check aliases
    for (const alias of conv.aliases) {
      const aliasDistance = levenshteinDistance(search, alias);
      if (aliasDistance < bestScore) {
        bestScore = aliasDistance;
      }
    }
    
    // If score is good enough (threshold 3), add to matches
    if (bestScore <= 3) {
      matches.push({ convention: conv, score: bestScore });
    }
  }
  
  // Sort by score (best matches first)
  matches.sort((a, b) => a.score - b.score);
  
  return matches.map(m => m.convention);
};

export const fuzzyMatchConvention = memoizeLRU(
  _fuzzyMatchConvention,
  50,
  (search, conventions) => `fuzzy:${search.toLowerCase()}:${conventions.length}`
);

// ============================================================================
// TERM NORMALIZATION
// ============================================================================

/**
 * Normalize technology terms to match JSON values
 */
export function normalizeTechnology(term: string): string[] {
  const termLower = term.toLowerCase().trim();
  
  const mappings: Record<string, string[]> = {
    'fibre': ['FIBRE', 'FTTH', 'VDSL_FTTH', 'ADSL_FIBRE', 'VDSL_FIBRE', 'ADSL_VDSL_FIBRE'],
    'fiber': ['FIBRE', 'FTTH', 'VDSL_FTTH', 'ADSL_FIBRE', 'VDSL_FIBRE', 'ADSL_VDSL_FIBRE'],
    'ftth': ['FTTH', 'FIBRE', 'VDSL_FTTH'],
    'adsl': ['ADSL', 'ADSL_VDSL_FIBRE', 'ADSL_FIBRE', 'ADSL_VDSL'],
    'vdsl': ['VDSL', 'VDSL_FTTH', 'VDSL_FIBRE', 'ADSL_VDSL_FIBRE', 'ADSL_VDSL'],
  };
  
  return mappings[termLower] || [term.toUpperCase()];
}

/**
 * Normalize price terms (gratuit = 0 DA)
 */
export function normalizePrice(term: string): number | null {
  const termLower = term.toLowerCase().trim();
  
  if (termLower === 'gratuit' || termLower === 'free' || termLower === 'offert') {
    return 0;
  }
  
  // Extract number from string like "2000 DA" or "2000"
  const match = term.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

export interface SearchConventionsParams {
  partnerName?: string;
  clientType?: 'B2C' | 'B2B';
  useFuzzy?: boolean;
}

/**
 * Search conventions by partner name or client type - OPTIMIZED
 */
const _searchConventions = async (params: SearchConventionsParams): Promise<Convention[]> => {
  const conventions = await loadConventions();
  let results: Convention[];
  
  // Use normalized search terms for O(1) lookup when possible
  if (params.partnerName && normalizedSearchTerms) {
    const searchLower = params.partnerName.toLowerCase().trim();
    
    // Try exact match first (O(1))
    if (normalizedSearchTerms.has(searchLower)) {
      results = normalizedSearchTerms.get(searchLower)!;
    } else if (params.useFuzzy !== false) {
      // Fall back to fuzzy matching only if exact fails
      results = fuzzyMatchConvention(params.partnerName, conventions);
    } else {
      // Substring search
      results = conventions.filter(c => 
        c.partner_name.toLowerCase().includes(searchLower) ||
        c.aliases.some(a => a.toLowerCase().includes(searchLower))
      );
    }
  } else {
    results = [...conventions];
  }
  
  // Filter by client type
  if (params.clientType) {
    results = results.filter(c => c.client_type === params.clientType);
  }
  
  return results;
}

// Export with memoization
export const searchConventions = memoizeLRU(_searchConventions);

export interface CheckEligibilityParams {
  conventionId: string;
  isActive?: boolean;
  isRetired?: boolean;
  isFamilyMember?: boolean;
  isSubsidiary?: boolean;
  jobLevel?: string;
}

/**
 * Check if user is eligible for a specific convention - OPTIMIZED
 */
export async function checkEligibility(params: CheckEligibilityParams): Promise<{
  eligible: boolean;
  reasons: string[];
  convention: Convention | null;
}> {
  await loadConventions(); // Ensure indexes are loaded
  const convention = indexById?.get(params.conventionId);
  
  if (!convention) {
    return {
      eligible: false,
      reasons: ['Convention introuvable'],
      convention: null,
    };
  }
  
  const reasons: string[] = [];
  const eligibility = convention.eligibility;
  
  // Check active status
  if (params.isActive && eligibility.active === false) {
    reasons.push('Les employés actifs ne sont pas éligibles');
  }
  
  // Check retired status
  if (params.isRetired && eligibility.retired === false) {
    reasons.push('Les retraités ne sont pas éligibles');
  }
  
  // Check family eligibility
  if (params.isFamilyMember && eligibility.family === false) {
    reasons.push('Les membres de la famille ne sont pas éligibles');
  }
  
  // Check subsidiary eligibility
  if (params.isSubsidiary && eligibility.subsidiaries === false) {
    reasons.push('Les filiales ne sont pas éligibles');
  }
  
  // Positive eligibility checks
  const positiveReasons: string[] = [];
  
  if (params.isActive && eligibility.active === true) {
    positiveReasons.push('Employés actifs acceptés');
  }
  
  if (params.isRetired && eligibility.retired === true) {
    positiveReasons.push('Retraités acceptés');
  }
  
  if (params.isFamilyMember && eligibility.family === true) {
    positiveReasons.push(`Famille acceptée${eligibility.family_details ? ' (' + eligibility.family_details + ')' : ''}`);
  }
  
  return {
    eligible: reasons.length === 0 && positiveReasons.length > 0,
    reasons: reasons.length > 0 ? reasons : positiveReasons,
    convention,
  };
}

export interface SearchOffersParams {
  conventionIds?: string[];
  category?: 'INTERNET' | 'TELEPHONY' | '4G' | 'HARDWARE' | 'EMAIL' | 'E-LEARNING';
  technology?: string;
  minSpeed?: number;
  maxSpeed?: number;
  maxPrice?: number;
  condition?: string;
}

/**
 * Search offers with multiple filters - OPTIMIZED with index usage and memoization
 */
const _searchOffers = async (params: SearchOffersParams): Promise<Array<{
  convention: Convention;
  offer: Offer;
}>> => {
  await loadConventions(); // Ensure indexes are loaded
  let candidates: Array<{ convention: Convention; offer: Offer }>;
  
  // Use the most selective index first for better performance
  if (params.category && indexByCategory) {
    // Start with category index (most selective)
    candidates = indexByCategory.get(params.category) || [];
  } else if (params.technology && indexByTechnology) {
    // Use technology index
    const techs = normalizeTechnology(params.technology);
    const techResults: Set<{ convention: Convention; offer: Offer }> = new Set();
    for (const tech of techs) {
      (indexByTechnology.get(tech) || []).forEach(item => techResults.add(item));
    }
    candidates = Array.from(techResults);
  } else if (params.maxPrice && indexByPriceRange) {
    // Use price range index
    candidates = [];
    for (const [range, items] of indexByPriceRange) {
      const maxRangePrice = range === '5000+' ? Infinity : parseInt(range.split('-')[1]);
      if (maxRangePrice <= params.maxPrice + 1000) { // Small buffer
        candidates.push(...items);
      }
    }
  } else {
    // Fall back to scanning all offers
    const conventions = conventionsCache!;
    candidates = [];
    for (const convention of conventions) {
      for (const offer of convention.offers) {
        candidates.push({ convention, offer });
      }
    }
  }
  
  // Filter by convention IDs if specified
  if (params.conventionIds && params.conventionIds.length > 0) {
    const idSet = new Set(params.conventionIds);
    candidates = candidates.filter(c => idSet.has(c.convention.convention_id));
  }
  
  // Apply remaining filters with early exit
  const results: Array<{ convention: Convention; offer: Offer }> = [];
  
  for (const item of candidates) {
    const { offer } = item;
    
    // Filter by category (if not already filtered)
    if (params.category && offer.category !== params.category) continue;
    
    // Filter by technology (if not already filtered)
    if (params.technology && offer.technology) {
      const normalizedTechs = normalizeTechnology(params.technology);
      if (!normalizedTechs.some(t => offer.technology?.includes(t))) continue;
    }
    
    // Filter by speed range
    if (params.minSpeed && offer.speed_mbps && offer.speed_mbps < params.minSpeed) continue;
    if (params.maxSpeed && offer.speed_mbps && offer.speed_mbps > params.maxSpeed) continue;
    
    // Filter by max price
    if (params.maxPrice && offer.price_convention_da > params.maxPrice) continue;
    
    // Filter by condition
    if (params.condition && offer.condition && offer.condition !== params.condition) continue;
    
    results.push(item);
  }
  
  // Sort by price (ascending)
  results.sort((a, b) => a.offer.price_convention_da - b.offer.price_convention_da);
  
  return results;
};

export const searchOffers = memoizeLRU(
  _searchOffers,
  100,
  (params) => createSearchKey(params)
);

/**
 * Get required documents for a convention - O(1) lookup
 */
export async function getRequiredDocuments(conventionId: string): Promise<{
  convention: Convention | null;
  documents: string[];
}> {
  await loadConventions(); // Ensure indexes are loaded
  const convention = indexById?.get(conventionId);
  
  return {
    convention: convention || null,
    documents: convention?.documents || [],
  };
}

/**
 * Get full details of a convention - O(1) lookup
 */
export async function getConventionDetails(conventionId: string): Promise<Convention | null> {
  await loadConventions(); // Ensure indexes are loaded
  return indexById?.get(conventionId) || null;
}

/**
 * Compare multiple offers - OPTIMIZED with O(1) lookups
 */
export async function compareOffers(offerIds: Array<{ conventionId: string; offerIndex: number }>): Promise<Array<{
  convention: Convention;
  offer: Offer;
  savings?: number;
  savingsPercent?: string;
}>> {
  await loadConventions(); // Ensure indexes are loaded
  const results: Array<{
    convention: Convention;
    offer: Offer;
    savings?: number;
    savingsPercent?: string;
  }> = [];
  
  for (const { conventionId, offerIndex } of offerIds) {
    const convention = indexById?.get(conventionId);
    if (!convention || !convention.offers[offerIndex]) {
      continue;
    }
    
    const offer = convention.offers[offerIndex];
    
    // Calculate savings if public price exists
    let savings: number | undefined;
    let savingsPercent: string | undefined;
    
    if (offer.price_public_da) {
      savings = offer.price_public_da - offer.price_convention_da;
      savingsPercent = `${Math.round((savings / offer.price_public_da) * 100)}%`;
    }
    
    results.push({
      convention,
      offer,
      savings,
      savingsPercent,
    });
  }
  
  return results;
}

// ============================================================================
// PROGRESSIVE RELAXATION (for zero results)
// ============================================================================

/**
 * Progressively relax search criteria when no results found
 */
export async function relaxedSearchOffers(params: SearchOffersParams): Promise<{
  results: Array<{ convention: Convention; offer: Offer }>;
  relaxedCriteria: string[];
}> {
  const relaxedCriteria: string[] = [];
  let results = await searchOffers(params);
  
  if (results.length > 0) {
    return { results, relaxedCriteria };
  }
  
  // Step 1: Relax price constraint by 20%
  if (params.maxPrice) {
      const newMaxPrice = Math.ceil(params.maxPrice * 1.2);
    relaxedCriteria.push(`Prix max élargi à ${newMaxPrice} DA`);
    results = await searchOffers({ ...params, maxPrice: newMaxPrice });    if (results.length > 0) {
      return { results, relaxedCriteria };
    }
  }
  
  // Step 2: Remove speed constraints
  if (params.minSpeed || params.maxSpeed) {
    relaxedCriteria.push('Contraintes de vitesse supprimées');
    results = await searchOffers({ ...params, minSpeed: undefined, maxSpeed: undefined });
    
    if (results.length > 0) {
      return { results, relaxedCriteria };
    }
  }
  
  // Step 3: Remove technology constraint
  if (params.technology) {
    relaxedCriteria.push('Contrainte de technologie supprimée');
    results = await searchOffers({ ...params, technology: undefined });
    
    if (results.length > 0) {
      return { results, relaxedCriteria };
    }
  }
  
  // Step 4: Keep only category
  if (params.category) {
    relaxedCriteria.push('Toutes les offres de la catégorie');
    results = await searchOffers({ category: params.category });
  }
  
  return { results, relaxedCriteria };
}
