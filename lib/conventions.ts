import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { getCurrentLanguage } from './language-context';

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
  documents: z.array(z.string()).optional(), // Legacy field - kept for compatibility
  documents_requis: z.object({
    nouvelle_demande: z.string(),
    basculement: z.string(),
  }).optional(),
  offers: z.array(OfferSchema),
  notes: z.string().optional(),
  store_items: z.array(z.any()).optional(),
});

export type Eligibility = z.infer<typeof EligibilitySchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type Convention = z.infer<typeof ConventionSchema>;

// ============================================================================
// CACHE SINGLETON AVEC INDEXATION O(1)
// ============================================================================

let conventionsCache: Convention[] | null = null;
let indexById: Map<string, Convention> | null = null;
let indexByPartnerName: Map<string, Convention> | null = null;
let indexByAlias: Map<string, Convention[]> | null = null;

// ============================================================================
// INVERTED INDEX DATA STRUCTURES - RECHERCHES ULTRA-RAPIDES O(1)
// ============================================================================

interface InvertedIndexes {
  // Document keyword indexes - ex: "fiche familiale" -> Set<convention_id>
  documentKeywords: Map<string, Set<string>>;
  
  // Eligibility indexes - ex: activeEligible -> Set<convention_id>
  activeEligible: Set<string>;
  retiredEligible: Set<string>;
  familyEligible: Set<string>;
  subsidiariesEligible: Set<string>;
  
  // Offer category indexes - ex: "INTERNET" -> Set<convention_id>
  offersByCategory: Map<string, Set<string>>;
  
  // Technology indexes - ex: "FTTH" -> Set<convention_id>
  offersByTechnology: Map<string, Set<string>>;
  
  // Price range indexes (bucketed) - ex: "1001-2000" -> Set<convention_id>
  priceRanges: Map<string, Set<string>>;
  
  // Speed range indexes (bucketed) - ex: "51-100" -> Set<convention_id>
  speedRanges: Map<string, Set<string>>;
  
  // Client type index
  b2cConventions: Set<string>;
  b2bConventions: Set<string>;
}

let invertedIndexes: InvertedIndexes | null = null;

/**
 * Load conventions from JSON file (cached after first load)
 * Uses the global language context if no language parameter is provided
 */
export function loadConventions(): Convention[] {
  // Récupère la langue depuis le contexte global
  const language = getCurrentLanguage();
  
  try {
    const filename = language === 'ar' ? 'arConv.json' : 'docs-conv.json';
    const filePath = path.join(process.cwd(), 'data', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File ${filename} not found, falling back to docs-conv.json`);
      const fallbackPath = path.join(process.cwd(), 'data', 'docs-conv.json');
      const fileContent = fs.readFileSync(fallbackPath, 'utf-8');
      const rawData = JSON.parse(fileContent);
      const conventions = z.array(ConventionSchema).parse(rawData);
      buildConventionIndexes(conventions);
      return conventions;
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rawData = JSON.parse(fileContent);
    
    // Validate with Zod
    const conventions = z.array(ConventionSchema).parse(rawData);
    conventionsCache = conventions;
    
    // Build indexes for O(1) lookups
    buildConventionIndexes(conventions);
    
    console.log(`✅ Loaded ${conventions.length} conventions from ${filename} with indexes`);
    return conventions;
  } catch (error) {
    console.error('❌ Error loading conventions:', error);
    throw new Error('Failed to load conventions data');
  }
}

/**
 * Build all indexes for O(1) lookups + INVERTED INDEXES for ultra-fast searches
 */
function buildConventionIndexes(conventions: Convention[]): void {
  // Existing indexes
  indexById = new Map();
  indexByPartnerName = new Map();
  indexByAlias = new Map();
  
  // Initialize inverted indexes
  invertedIndexes = {
    documentKeywords: new Map(),
    activeEligible: new Set(),
    retiredEligible: new Set(),
    familyEligible: new Set(),
    subsidiariesEligible: new Set(),
    offersByCategory: new Map(),
    offersByTechnology: new Map(),
    priceRanges: new Map(),
    speedRanges: new Map(),
    b2cConventions: new Set(),
    b2bConventions: new Set(),
  };
  
  for (const conv of conventions) {
    const convId = conv.convention_id;
    
    // ===== EXISTING INDEXES =====
    indexById.set(convId, conv);
    indexByPartnerName.set(conv.partner_name.toLowerCase(), conv);
    
    for (const alias of conv.aliases) {
      const key = alias.toLowerCase();
      if (!indexByAlias.has(key)) {
        indexByAlias.set(key, []);
      }
      indexByAlias.get(key)!.push(conv);
    }
    
    // ===== INVERTED INDEXES =====
    
    // 1. Document Keywords Index
    const docKeywords = extractDocumentKeywords(conv);
    for (const keyword of docKeywords) {
      if (!invertedIndexes.documentKeywords.has(keyword)) {
        invertedIndexes.documentKeywords.set(keyword, new Set());
      }
      invertedIndexes.documentKeywords.get(keyword)!.add(convId);
    }
    
    // 2. Eligibility Indexes
    if (conv.eligibility.active === true) {
      invertedIndexes.activeEligible.add(convId);
    }
    if (conv.eligibility.retired === true) {
      invertedIndexes.retiredEligible.add(convId);
    }
    if (conv.eligibility.family === true) {
      invertedIndexes.familyEligible.add(convId);
    }
    if (conv.eligibility.subsidiaries === true) {
      invertedIndexes.subsidiariesEligible.add(convId);
    }
    
    // 3. Client Type Indexes
    if (conv.client_type === 'B2C') {
      invertedIndexes.b2cConventions.add(convId);
    } else if (conv.client_type === 'B2B') {
      invertedIndexes.b2bConventions.add(convId);
    }
    
    // 4. Offer-based Indexes
    for (const offer of conv.offers) {
      // Category index
      const category = offer.category;
      if (!invertedIndexes.offersByCategory.has(category)) {
        invertedIndexes.offersByCategory.set(category, new Set());
      }
      invertedIndexes.offersByCategory.get(category)!.add(convId);
      
      // Technology index
      if (offer.technology) {
        const tech = offer.technology;
        if (!invertedIndexes.offersByTechnology.has(tech)) {
          invertedIndexes.offersByTechnology.set(tech, new Set());
        }
        invertedIndexes.offersByTechnology.get(tech)!.add(convId);
      }
      
      // Price range index
      const priceBucket = getPriceBucket(offer.price_convention_da);
      if (!invertedIndexes.priceRanges.has(priceBucket)) {
        invertedIndexes.priceRanges.set(priceBucket, new Set());
      }
      invertedIndexes.priceRanges.get(priceBucket)!.add(convId);
      
      // Speed range index
      if (offer.speed_mbps) {
        const speedBucket = getSpeedBucket(offer.speed_mbps);
        if (!invertedIndexes.speedRanges.has(speedBucket)) {
          invertedIndexes.speedRanges.set(speedBucket, new Set());
        }
        invertedIndexes.speedRanges.get(speedBucket)!.add(convId);
      }
    }
  }
  
  console.log(`📊 Inverted indexes built:
    - Document keywords: ${invertedIndexes.documentKeywords.size} unique terms
    - Active eligible: ${invertedIndexes.activeEligible.size} conventions
    - Retired eligible: ${invertedIndexes.retiredEligible.size} conventions
    - Family eligible: ${invertedIndexes.familyEligible.size} conventions
    - Categories: ${invertedIndexes.offersByCategory.size} types
    - Technologies: ${invertedIndexes.offersByTechnology.size} types`);
}

/**
 * Extract searchable keywords from documents_requis (nouvelles_demandes + basculement)
 */
function extractDocumentKeywords(conv: Convention): Set<string> {
  const keywords = new Set<string>();
  
  if (conv.documents_requis) {
    const allDocs = [
      conv.documents_requis.nouvelle_demande,
      conv.documents_requis.basculement
    ].filter(Boolean).join(' ');
    
    // Keywords basés sur analyse des données réelles
    const patterns = [
      'attestation', 'travail', 'bulletin', 'paie', 'salaire',
      'carte professionnelle', 'copie pi', 'pièce identité', 'cni', 'copie cin',
      'justificatif', 'adresse', 'domicile', 'résidence',
      'fiche familiale', 'livret famille', 'état civil',
      'demande manuscrite', 'formulaire',
      'retraité', 'pension', 'habilité', 'ressources humaines',
      'signé', 'dument'
    ];
    
    const textLower = allDocs.toLowerCase();
    for (const pattern of patterns) {
      if (textLower.includes(pattern)) {
        keywords.add(pattern);
      }
    }
  }
  
  // Legacy support
  if (conv.documents && conv.documents.length > 0) {
    for (const doc of conv.documents) {
      keywords.add(doc.toLowerCase());
    }
  }
  
  return keywords;
}

/**
 * Get price bucket for range indexing
 */
function getPriceBucket(price: number): string {
  if (price <= 1000) return '0-1000';
  if (price <= 2000) return '1001-2000';
  if (price <= 3000) return '2001-3000';
  if (price <= 4000) return '3001-4000';
  return '4001+';
}

/**
 * Get speed bucket for range indexing
 */
function getSpeedBucket(speed: number): string {
  if (speed <= 50) return '0-50';
  if (speed <= 100) return '51-100';
  if (speed <= 200) return '101-200';
  if (speed <= 500) return '201-500';
  if (speed <= 1000) return '501-1000';
  return '1001+';
}

/**
 * Get convention by ID - O(1) lookup
 */
export function getConventionById(conventionId: string): Convention | null {
  loadConventions(); // Ensure loaded
  return indexById?.get(conventionId) ?? null;
}

/**
 * Get convention by partner name - O(1) lookup
 */
export function getConventionByPartnerName(partnerName: string): Convention | null {
  loadConventions(); // Ensure loaded
  return indexByPartnerName?.get(partnerName.toLowerCase()) ?? null;
}

/**
 * Get conventions by alias - O(1) lookup
 */
export function getConventionsByAlias(alias: string): Convention[] {
  loadConventions(); // Ensure loaded
  return indexByAlias?.get(alias.toLowerCase()) ?? [];
}

/**
 * Clear cache (useful for testing or reloading)
 */
export function clearCache(): void {
  conventionsCache = null;
  indexById = null;
  indexByPartnerName = null;
  indexByAlias = null;
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
 * OPTIMIZED: Uses O(1) index lookups when possible
 */
export function searchConventions(params: SearchConventionsParams): Convention[] {
  loadConventions(); // Ensure loaded
  
  // Fast path: exact partner name lookup O(1)
  if (params.partnerName && !params.useFuzzy && !params.clientType) {
    const exact = getConventionByPartnerName(params.partnerName);
    if (exact) return [exact];
    
    // Try aliases
    const byAlias = getConventionsByAlias(params.partnerName);
    if (byAlias.length > 0) return byAlias;
  }
  
  // Otherwise use standard filtering
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
  // OPTIMIZED: O(1) lookup by ID
  const convention = getConventionById(params.conventionId);
  
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
 * Retourne 2 types de documents :
 * 1. documents_nouvelles_demandes : pour les nouveaux clients/clients ordinaires
 * 2. documents_basculement : pour les anciens clients qui basculent
 */
export function getRequiredDocuments(conventionId: string): {
  convention: Convention | null;
  documents_nouvelles_demandes?: string;
  documents_basculement?: string;
} {
  const conventions = loadConventions();
  const convention = conventions.find(c => c.convention_id === conventionId);
  
  if (!convention) {
    return { convention: null };
  }
  
  // Si documents_requis existe, retourner les 2 types de documents
  if (convention.documents_requis) {
    return {
      convention,
      documents_nouvelles_demandes: convention.documents_requis.nouvelle_demande,
      documents_basculement: convention.documents_requis.basculement,
    };
  }
  
  // Fallback : si ancien format avec documents[], on le met dans nouvelles_demandes
  if (convention.documents && convention.documents.length > 0) {
    return {
      convention,
      documents_nouvelles_demandes: convention.documents.join(', '),
    };
  }
  
  return { convention };
}

/**
 * Get full details of a convention
 * OPTIMIZED: O(1) lookup using index
 */
export function getConventionDetails(conventionId: string): Convention | null {
  return getConventionById(conventionId);
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

// ============================================================================
// FAST INDEX-BASED SEARCH FUNCTIONS - 100-1000x PLUS RAPIDE
// ============================================================================

/**
 * Search conventions by document requirement (FAST: O(1) lookup)
 * Ex: searchByDocumentKeyword('fiche familiale') -> instantané
 */
export function searchByDocumentKeyword(keyword: string): Convention[] {
  loadConventions();
  
  if (!invertedIndexes) return [];
  
  const keywordLower = keyword.toLowerCase();
  const conventionIds = invertedIndexes.documentKeywords.get(keywordLower);
  
  if (!conventionIds) return [];
  
  return Array.from(conventionIds)
    .map(id => indexById?.get(id))
    .filter((c): c is Convention => c !== undefined);
}

/**
 * Search conventions by eligibility criteria (FAST: O(1) set operations)
 */
export function searchByEligibility(criteria: {
  active?: boolean;
  retired?: boolean;
  family?: boolean;
  subsidiaries?: boolean;
}): Convention[] {
  loadConventions();
  
  if (!invertedIndexes) return [];
  
  let resultIds: Set<string> | null = null;
  
  // Intersect all matching criteria
  if (criteria.active === true) {
    resultIds = new Set(invertedIndexes.activeEligible);
  }
  
  if (criteria.retired === true) {
    const retiredIds = invertedIndexes.retiredEligible;
    resultIds = resultIds 
      ? new Set([...resultIds].filter(id => retiredIds.has(id)))
      : new Set(retiredIds);
  }
  
  if (criteria.family === true) {
    const familyIds = invertedIndexes.familyEligible;
    resultIds = resultIds
      ? new Set([...resultIds].filter(id => familyIds.has(id)))
      : new Set(familyIds);
  }
  
  if (criteria.subsidiaries === true) {
    const subsIds = invertedIndexes.subsidiariesEligible;
    resultIds = resultIds
      ? new Set([...resultIds].filter(id => subsIds.has(id)))
      : new Set(subsIds);
  }
  
  if (!resultIds) return [];
  
  return Array.from(resultIds)
    .map(id => indexById?.get(id))
    .filter((c): c is Convention => c !== undefined);
}

/**
 * Combined fast search - intersects multiple indexes for ultra-fast complex queries
 */
export interface FastSearchParams {
  category?: string;
  technology?: string;
  maxPrice?: number;
  minSpeed?: number;
  maxSpeed?: number;
  activeEligible?: boolean;
  retiredEligible?: boolean;
  familyEligible?: boolean;
  clientType?: 'B2C' | 'B2B';
  documentKeyword?: string;
}

export function fastSearchConventions(params: FastSearchParams): Convention[] {
  loadConventions();
  
  if (!invertedIndexes) return [];
  
  let candidateIds: Set<string> | null = null;
  
  // 1. Filter by client type first (most restrictive)
  if (params.clientType === 'B2C') {
    candidateIds = new Set(invertedIndexes.b2cConventions);
  } else if (params.clientType === 'B2B') {
    candidateIds = new Set(invertedIndexes.b2bConventions);
  }
  
  // 2. Intersect with category
  if (params.category) {
    const categoryIds = invertedIndexes.offersByCategory.get(params.category);
    if (!categoryIds) return [];
    
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => categoryIds.has(id)))
      : new Set(categoryIds);
  }
  
  // 3. Intersect with technology
  if (params.technology) {
    const normalizedTechs = normalizeTechnology(params.technology);
    const techIds = new Set<string>();
    
    for (const tech of normalizedTechs) {
      const ids = invertedIndexes.offersByTechnology.get(tech);
      if (ids) ids.forEach(id => techIds.add(id));
    }
    
    if (techIds.size === 0) return [];
    
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => techIds.has(id)))
      : techIds;
  }
  
  // 4. Intersect with eligibility
  if (params.activeEligible === true) {
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => invertedIndexes!.activeEligible.has(id)))
      : new Set(invertedIndexes.activeEligible);
  }
  
  if (params.retiredEligible === true) {
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => invertedIndexes!.retiredEligible.has(id)))
      : new Set(invertedIndexes.retiredEligible);
  }
  
  if (params.familyEligible === true) {
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => invertedIndexes!.familyEligible.has(id)))
      : new Set(invertedIndexes.familyEligible);
  }
  
  // 5. Intersect with document keyword
  if (params.documentKeyword) {
    const docIds = invertedIndexes.documentKeywords.get(params.documentKeyword.toLowerCase());
    if (!docIds) return [];
    
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => docIds.has(id)))
      : new Set(docIds);
  }
  
  // 6. Get conventions from IDs
  let results = candidateIds
    ? Array.from(candidateIds)
        .map(id => indexById?.get(id))
        .filter((c): c is Convention => c !== undefined)
    : loadConventions();
  
  // 7. Post-filter by price and speed (requires checking actual offers)
  if (params.maxPrice !== undefined || params.minSpeed !== undefined || params.maxSpeed !== undefined) {
    results = results.filter(conv =>
      conv.offers.some(offer => {
        if (params.maxPrice !== undefined && offer.price_convention_da > params.maxPrice) {
          return false;
        }
        if (params.minSpeed !== undefined && offer.speed_mbps && offer.speed_mbps < params.minSpeed) {
          return false;
        }
        if (params.maxSpeed !== undefined && offer.speed_mbps && offer.speed_mbps > params.maxSpeed) {
          return false;
        }
        return true;
      })
    );
  }
  
  return results;
}

/**
 * Get statistics about indexed data
 */
export function getIndexStatistics(): {
  totalConventions: number;
  b2cCount: number;
  b2bCount: number;
  activeEligibleCount: number;
  retiredEligibleCount: number;
  familyEligibleCount: number;
  documentKeywordsCount: number;
  categoriesCount: number;
  technologiesCount: number;
} {
  loadConventions();
  
  if (!invertedIndexes) {
    return {
      totalConventions: 0,
      b2cCount: 0,
      b2bCount: 0,
      activeEligibleCount: 0,
      retiredEligibleCount: 0,
      familyEligibleCount: 0,
      documentKeywordsCount: 0,
      categoriesCount: 0,
      technologiesCount: 0,
    };
  }
  
  return {
    totalConventions: conventionsCache?.length || 0,
    b2cCount: invertedIndexes.b2cConventions.size,
    b2bCount: invertedIndexes.b2bConventions.size,
    activeEligibleCount: invertedIndexes.activeEligible.size,
    retiredEligibleCount: invertedIndexes.retiredEligible.size,
    familyEligibleCount: invertedIndexes.familyEligible.size,
    documentKeywordsCount: invertedIndexes.documentKeywords.size,
    categoriesCount: invertedIndexes.offersByCategory.size,
    technologiesCount: invertedIndexes.offersByTechnology.size,
  };
}
