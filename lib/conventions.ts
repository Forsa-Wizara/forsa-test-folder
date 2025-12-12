import { z } from 'zod';
import fs from 'fs';
import path from 'path';

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
// CACHE SINGLETON
// ============================================================================

let conventionsCache: Convention[] | null = null;

/**
 * Load conventions from JSON file (cached after first load)
 */
export function loadConventions(): Convention[] {
  if (conventionsCache !== null) {
    return conventionsCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'docs-conv.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rawData = JSON.parse(fileContent);
    
    // Validate with Zod
    const conventions = z.array(ConventionSchema).parse(rawData);
    conventionsCache = conventions;
    
    console.log(`✅ Loaded ${conventions.length} conventions from JSON`);
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
 * Find conventions by fuzzy matching partner name or aliases
 */
export function fuzzyMatchConvention(search: string, conventions: Convention[]): Convention[] {
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
}

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
 * Search conventions by partner name or client type
 */
export function searchConventions(params: SearchConventionsParams): Convention[] {
  const conventions = loadConventions();
  let results = [...conventions];
  
  // Filter by client type
  if (params.clientType) {
    results = results.filter(c => c.client_type === params.clientType);
  }
  
  // Filter by partner name
  if (params.partnerName) {
    if (params.useFuzzy !== false) {
      // Use fuzzy matching (default)
      results = fuzzyMatchConvention(params.partnerName, results);
    } else {
      // Exact matching
      const searchLower = params.partnerName.toLowerCase();
      results = results.filter(c => 
        c.partner_name.toLowerCase().includes(searchLower) ||
        c.aliases.some(a => a.toLowerCase().includes(searchLower))
      );
    }
  }
  
  return results;
}

export interface CheckEligibilityParams {
  conventionId: string;
  isActive?: boolean;
  isRetired?: boolean;
  isFamilyMember?: boolean;
  isSubsidiary?: boolean;
  jobLevel?: string;
}

/**
 * Check if user is eligible for a specific convention
 */
export function checkEligibility(params: CheckEligibilityParams): {
  eligible: boolean;
  reasons: string[];
  convention: Convention | null;
} {
  const conventions = loadConventions();
  const convention = conventions.find(c => c.convention_id === params.conventionId);
  
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
 * Search offers with multiple filters
 */
export function searchOffers(params: SearchOffersParams): Array<{
  convention: Convention;
  offer: Offer;
}> {
  const conventions = loadConventions();
  const results: Array<{ convention: Convention; offer: Offer }> = [];
  
  // Filter conventions
  let targetConventions = conventions;
  if (params.conventionIds && params.conventionIds.length > 0) {
    targetConventions = conventions.filter(c => 
      params.conventionIds!.includes(c.convention_id)
    );
  }
  
  // Search through offers
  for (const convention of targetConventions) {
    for (const offer of convention.offers) {
      let matches = true;
      
      // Filter by category
      if (params.category && offer.category !== params.category) {
        matches = false;
      }
      
      // Filter by technology (with normalization)
      if (params.technology && offer.technology) {
        const normalizedTechs = normalizeTechnology(params.technology);
        if (!normalizedTechs.some(t => offer.technology?.includes(t))) {
          matches = false;
        }
      }
      
      // Filter by speed range
      if (params.minSpeed && offer.speed_mbps && offer.speed_mbps < params.minSpeed) {
        matches = false;
      }
      if (params.maxSpeed && offer.speed_mbps && offer.speed_mbps > params.maxSpeed) {
        matches = false;
      }
      
      // Filter by max price
      if (params.maxPrice && offer.price_convention_da > params.maxPrice) {
        matches = false;
      }
      
      // Filter by condition
      if (params.condition && offer.condition && offer.condition !== params.condition) {
        matches = false;
      }
      
      if (matches) {
        results.push({ convention, offer });
      }
    }
  }
  
  // Sort by price (ascending)
  results.sort((a, b) => a.offer.price_convention_da - b.offer.price_convention_da);
  
  return results;
}

/**
 * Get required documents for a convention
 */
export function getRequiredDocuments(conventionId: string): {
  convention: Convention | null;
  documents: string[];
} {
  const conventions = loadConventions();
  const convention = conventions.find(c => c.convention_id === conventionId);
  
  return {
    convention: convention || null,
    documents: convention?.documents || [],
  };
}

/**
 * Get full details of a convention
 */
export function getConventionDetails(conventionId: string): Convention | null {
  const conventions = loadConventions();
  return conventions.find(c => c.convention_id === conventionId) || null;
}

/**
 * Compare multiple offers
 */
export function compareOffers(offerIds: Array<{ conventionId: string; offerIndex: number }>): Array<{
  convention: Convention;
  offer: Offer;
  savings?: number;
  savingsPercent?: string;
}> {
  const conventions = loadConventions();
  const results: Array<{
    convention: Convention;
    offer: Offer;
    savings?: number;
    savingsPercent?: string;
  }> = [];
  
  for (const { conventionId, offerIndex } of offerIds) {
    const convention = conventions.find(c => c.convention_id === conventionId);
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
export function relaxedSearchOffers(params: SearchOffersParams): {
  results: Array<{ convention: Convention; offer: Offer }>;
  relaxedCriteria: string[];
} {
  const relaxedCriteria: string[] = [];
  let results = searchOffers(params);
  
  if (results.length > 0) {
    return { results, relaxedCriteria };
  }
  
  // Step 1: Relax price constraint by 20%
  if (params.maxPrice) {
    const newMaxPrice = Math.ceil(params.maxPrice * 1.2);
    relaxedCriteria.push(`Prix max élargi à ${newMaxPrice} DA`);
    results = searchOffers({ ...params, maxPrice: newMaxPrice });
    
    if (results.length > 0) {
      return { results, relaxedCriteria };
    }
  }
  
  // Step 2: Remove speed constraints
  if (params.minSpeed || params.maxSpeed) {
    relaxedCriteria.push('Contraintes de vitesse supprimées');
    results = searchOffers({ ...params, minSpeed: undefined, maxSpeed: undefined });
    
    if (results.length > 0) {
      return { results, relaxedCriteria };
    }
  }
  
  // Step 3: Remove technology constraint
  if (params.technology) {
    relaxedCriteria.push('Contrainte de technologie supprimée');
    results = searchOffers({ ...params, technology: undefined });
    
    if (results.length > 0) {
      return { results, relaxedCriteria };
    }
  }
  
  // Step 4: Keep only category
  if (params.category) {
    relaxedCriteria.push('Toutes les offres de la catégorie');
    results = searchOffers({ category: params.category });
  }
  
  return { results, relaxedCriteria };
}
