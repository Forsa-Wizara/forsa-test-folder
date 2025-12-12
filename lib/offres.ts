// ============================================================================
// OFFRES RÉFÉRENTIEL - Search & Filter Functions
// Optimized with O(1) lookups and indexed access
// ============================================================================

import { z } from 'zod';
import { prisma } from './prisma';
import { memoizeLRU, createSearchKey } from './cache-utils';

// ============================================================================
// ZOD SCHEMAS & TYPES
// ============================================================================

export const PeriodeActivationSchema = z.object({
  type: z.string(),
  details: z.string().optional(),
}).optional().nullable();

export const ValiditeSchema = z.object({
  type: z.string(),
  duree_heures: z.number().optional(),
  duree_jours: z.number().optional(),
}).optional().nullable();

export const DebitsEligiblesSchema = z.object({
  debit_initial_min_mbps: z.number().optional(),
  debit_initial_max_mbps: z.number().optional(),
  debits_final_disponibles_mbps: z.array(z.number()).optional(),
}).optional().nullable();

export const CaracteristiquesDebitSchema = z.object({
  upload_ratio: z.number().optional().nullable(),
  ping_optimise: z.boolean().optional(),
}).optional().nullable();

export const LigneTarifaireSchema = z.object({
  debit_initial_mbps: z.number().optional(),
  debit_final_mbps: z.number().optional(),
  tarif_actuel_da: z.number().optional(),
  tarif_nouveau_da: z.number().optional(),
  valeur: z.number().optional(),
  type_kit: z.string().optional(),
  longueur_metres: z.number().optional(),
  condition: z.string().optional(),
  volume_to: z.number().optional(),
  validite_jours: z.number().optional(),
}).passthrough();

export const TableauTarifaireSchema = z.object({
  type_tableau: z.string(),
  unite_prix: z.string(),
  lignes: z.array(LigneTarifaireSchema),
});

export const ProduitAssocieSchema = z.object({
  type_produit: z.string(),
  designation: z.string(),
  tarif_actuel_da_ttc: z.number().optional().nullable(),
  tarif_nouveau_da_ttc: z.number().optional().nullable(),
  conditions: z.array(z.string()).optional(),
});

export const OffreReferentielSchema = z.object({
  id_offre: z.string(),
  nom_commercial: z.string(),
  famille: z.string(),
  sous_famille: z.string(),
  technologies: z.array(z.string()),
  segments_cibles: z.array(z.string()),
  sous_segments: z.array(z.string()),
  client_type: z.string(),
  locataire: z.boolean().optional().nullable(),
  conventionne: z.boolean().optional().nullable(),
  types_clients_exclus: z.array(z.string()),
  type_offre: z.string(),
  engagement_mois: z.number().optional().nullable(),
  numero_document: z.string(),
  canaux_activation: z.array(z.string()),
  periode_activation: PeriodeActivationSchema,
  validite: ValiditeSchema,
  debits_eligibles: DebitsEligiblesSchema,
  caracteristiques_debit: CaracteristiquesDebitSchema,
  tarification: z.array(z.any()),
  avantages_principaux: z.array(z.string()),
  limitations: z.array(z.string()),
  conditions_particulieres: z.array(z.string()),
  tableaux_tarifaires: z.array(TableauTarifaireSchema),
  produits_associes: z.array(ProduitAssocieSchema),
  modes_paiement: z.array(z.string()),
  documents_a_fournir: z.array(z.string()),
  notes: z.array(z.string()),
});

export const OffresDataSchema = z.object({
  referentiel_offres: z.array(OffreReferentielSchema),
});

export type LigneTarifaire = z.infer<typeof LigneTarifaireSchema>;
export type TableauTarifaire = z.infer<typeof TableauTarifaireSchema>;
export type ProduitAssocie = z.infer<typeof ProduitAssocieSchema>;
export type OffreReferentiel = z.infer<typeof OffreReferentielSchema>;

// ============================================================================
// CACHE & INDEXES - O(1) Lookups
// ============================================================================

let offresCache: OffreReferentiel[] | null = null;
let indexById: Map<string, OffreReferentiel> | null = null;
let indexByFamille: Map<string, OffreReferentiel[]> | null = null;
let indexByTechnology: Map<string, OffreReferentiel[]> | null = null;
let indexByClientType: Map<string, OffreReferentiel[]> | null = null;
let indexBySegment: Map<string, OffreReferentiel[]> | null = null;

/**
 * Load offres from database with Prisma (cached after first load)
 */
export async function loadOffres(): Promise<OffreReferentiel[]> {
  if (offresCache !== null) {
    return offresCache;
  }

  try {
    const dbOffres = await prisma.offreReferentiel.findMany({
      include: {
        tableauxTarifaires: true,
        produitsAssocies: true,
      },
    });
    
    // Transform database format to application format
    const offres: OffreReferentiel[] = dbOffres.map(offre => ({
      id_offre: offre.idOffre,
      nom_commercial: offre.nomCommercial,
      famille: offre.famille,
      sous_famille: offre.sousFamille,
      technologies: JSON.parse(offre.technologies),
      segments_cibles: JSON.parse(offre.segmentsCibles),
      sous_segments: JSON.parse(offre.sousSegments),
      client_type: offre.clientType,
      locataire: offre.locataire ?? undefined,
      conventionne: offre.conventionne ?? undefined,
      types_clients_exclus: JSON.parse(offre.typesClientsExclus),
      type_offre: offre.typeOffre,
      engagement_mois: offre.engagementMois ?? undefined,
      numero_document: offre.numeroDocument,
      canaux_activation: JSON.parse(offre.canauxActivation),
      periode_activation: offre.periodeActivation ? JSON.parse(offre.periodeActivation) : undefined,
      validite: offre.validite ? JSON.parse(offre.validite) : undefined,
      debits_eligibles: offre.debitsEligibles ? JSON.parse(offre.debitsEligibles) : undefined,
      caracteristiques_debit: offre.caracteristiquesDebit ? JSON.parse(offre.caracteristiquesDebit) : undefined,
      tarification: JSON.parse(offre.tarification),
      avantages_principaux: JSON.parse(offre.avantagesPrincipaux),
      limitations: JSON.parse(offre.limitations),
      conditions_particulieres: JSON.parse(offre.conditionsParticulieres),
      tableaux_tarifaires: offre.tableauxTarifaires.map(t => ({
        type_tableau: t.typeTableau,
        unite_prix: t.unitePrix,
        lignes: JSON.parse(t.lignes),
      })),
      produits_associes: offre.produitsAssocies.map(p => ({
        type_produit: p.typeProduit,
        designation: p.designation,
        tarif_actuel_da_ttc: p.tarifActuelDaTtc ?? undefined,
        tarif_nouveau_da_ttc: p.tarifNouveauDaTtc ?? undefined,
        conditions: p.conditions ? JSON.parse(p.conditions) : undefined,
      })),
      modes_paiement: JSON.parse(offre.modesPaiement),
      documents_a_fournir: JSON.parse(offre.documentsAFournir),
      notes: JSON.parse(offre.notes),
    }));
    
    offresCache = offres;
    
    // Build indexes
    buildIndexes(offresCache);
    
    console.log(`✅ Loaded ${offresCache.length} offres from database`);
    return offresCache;
  } catch (error) {
    console.error('❌ Error loading offres:', error);
    throw new Error('Failed to load offres data');
  }
}

/**
 * Build all indexes for O(1) lookups
 */
function buildIndexes(offres: OffreReferentiel[]): void {
  indexById = new Map();
  indexByFamille = new Map();
  indexByTechnology = new Map();
  indexByClientType = new Map();
  indexBySegment = new Map();
  
  for (const offre of offres) {
    // Index by ID
    indexById.set(offre.id_offre, offre);
    
    // Index by famille
    const familleKey = offre.famille.toUpperCase();
    if (!indexByFamille.has(familleKey)) {
      indexByFamille.set(familleKey, []);
    }
    indexByFamille.get(familleKey)!.push(offre);
    
    // Index by technology
    for (const tech of offre.technologies) {
      const techKey = tech.toUpperCase();
      if (!indexByTechnology.has(techKey)) {
        indexByTechnology.set(techKey, []);
      }
      indexByTechnology.get(techKey)!.push(offre);
    }
    
    // Index by client_type
    const clientTypeKey = offre.client_type.toUpperCase();
    if (!indexByClientType.has(clientTypeKey)) {
      indexByClientType.set(clientTypeKey, []);
    }
    indexByClientType.get(clientTypeKey)!.push(offre);
    
    // Index by segment
    for (const segment of offre.segments_cibles) {
      const segmentKey = segment.toUpperCase();
      if (!indexBySegment.has(segmentKey)) {
        indexBySegment.set(segmentKey, []);
      }
      indexBySegment.get(segmentKey)!.push(offre);
    }
  }
}

/**
 * Clear cache
 */
export function clearOffresCache(): void {
  offresCache = null;
  indexById = null;
  indexByFamille = null;
  indexByTechnology = null;
  indexByClientType = null;
  indexBySegment = null;
}

// ============================================================================
// O(1) LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get offre by ID - O(1)
 */
export async function getOffreById(id: string): Promise<OffreReferentiel | null> {
  await loadOffres(); // Ensure loaded
  return indexById?.get(id) || null;
}

/**
 * Get offres by famille - O(1)
 */
export async function getOffresByFamille(famille: string): Promise<OffreReferentiel[]> {
  await loadOffres();
  return indexByFamille?.get(famille.toUpperCase()) || [];
}

/**
 * Get offres by technology - O(1)
 */
export async function getOffresByTechnology(technology: string): Promise<OffreReferentiel[]> {
  await loadOffres();
  // Normalize technology
  const normalized = normalizeTech(technology);
  const results: Set<OffreReferentiel> = new Set();
  
  for (const tech of normalized) {
    const offres = indexByTechnology?.get(tech.toUpperCase()) || [];
    offres.forEach(o => results.add(o));
  }
  
  return Array.from(results);
}

/**
 * Get offres by client type - O(1)
 */
export async function getOffresByClientType(clientType: string): Promise<OffreReferentiel[]> {
  await loadOffres();
  const key = clientType.toUpperCase();
  
  // Handle B2C_B2B which matches both
  const results: Set<OffreReferentiel> = new Set();
  
  const exact = indexByClientType?.get(key) || [];
  exact.forEach(o => results.add(o));
  
  // B2C_B2B offres match any client type
  const mixed = indexByClientType?.get('B2C_B2B') || [];
  mixed.forEach(o => results.add(o));
  
  return Array.from(results);
}

/**
 * Get offres by segment - O(1)
 */
export async function getOffresBySegment(segment: string): Promise<OffreReferentiel[]> {
  await loadOffres();
  return indexBySegment?.get(segment.toUpperCase()) || [];
}

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize technology terms
 */
function normalizeTech(term: string): string[] {
  const termLower = term.toLowerCase().trim();
  
  const mappings: Record<string, string[]> = {
    'fibre': ['FIBRE', 'FTTH', 'IDOOM FIBRE'],
    'fiber': ['FIBRE', 'FTTH', 'IDOOM FIBRE'],
    'ftth': ['FTTH', 'FIBRE', 'IDOOM FIBRE'],
    'adsl': ['ADSL'],
    'vdsl': ['VDSL'],
    '4g': ['4G', 'LTE'],
    'lte': ['4G', 'LTE'],
  };
  
  return mappings[termLower] || [term.toUpperCase()];
}

/**
 * Normalize segment terms
 */
function normalizeSegment(term: string): string[] {
  const termLower = term.toLowerCase().trim();
  
  const mappings: Record<string, string[]> = {
    'particulier': ['RESIDENTIEL'],
    'particuliers': ['RESIDENTIEL'],
    'residentiel': ['RESIDENTIEL'],
    'pro': ['PRO'],
    'professionnel': ['PRO'],
    'professionnels': ['PRO'],
    'entreprise': ['PRO'],
    'gamer': ['RESIDENTIEL'],
    'gaming': ['RESIDENTIEL'],
  };
  
  return mappings[termLower] || [term.toUpperCase()];
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

export interface SearchOffresParams {
  nom?: string;
  famille?: 'INTERNET' | '4G' | 'HARDWARE' | string;
  sousFamille?: string;
  technology?: string;
  segment?: 'RESIDENTIEL' | 'PRO' | string;
  clientType?: 'B2C' | 'B2B' | string;
  isLocataire?: boolean;
  isConventionne?: boolean;
  hasEngagement?: boolean;
  maxEngagementMois?: number;
  minDebit?: number;
  maxPrice?: number;
}

/**
 * Search offres with multiple filters - FURTHER OPTIMIZED with memoization
 */
const _searchOffresReferentiel = async (params: SearchOffresParams): Promise<OffreReferentiel[]> => {
  let candidates: OffreReferentiel[];
  
  // Use the most selective index first for minimal candidates
  if (params.famille) {
    candidates = await getOffresByFamille(params.famille);
  } else if (params.technology) {
    candidates = await getOffresByTechnology(params.technology);
  } else if (params.segment) {
    const normalized = normalizeSegment(params.segment);
    const resultSet = new Set<OffreReferentiel>();
    for (const seg of normalized) {
      (await getOffresBySegment(seg)).forEach(o => resultSet.add(o));
    }
    candidates = Array.from(resultSet);
  } else if (params.clientType) {
    candidates = await getOffresByClientType(params.clientType);
  } else {
    candidates = await loadOffres();
  }
  
  // Early exit if no candidates
  if (candidates.length === 0) return [];
  
  const results: OffreReferentiel[] = [];
  
  // Apply remaining filters with early continue for non-matches
  candidateLoop: for (const offre of candidates) {
    // Filter by nom (fuzzy) - most likely to eliminate candidates early
    if (params.nom) {
      const searchLower = params.nom.toLowerCase();
      if (!offre.nom_commercial.toLowerCase().includes(searchLower) &&
          !offre.id_offre.toLowerCase().includes(searchLower)) {
        continue;
      }
    }
    
    // Filter by sous_famille
    if (params.sousFamille) {
      if (!offre.sous_famille.toUpperCase().includes(params.sousFamille.toUpperCase())) {
        continue;
      }
    }
    
    // Filter by technology (skip if already used as primary filter)
    if (params.technology && !params.famille) {
      const normalized = normalizeTech(params.technology);
      let hasMatch = false;
      for (const tech of offre.technologies) {
        for (const norm of normalized) {
          if (tech.toUpperCase().includes(norm)) {
            hasMatch = true;
            break;
          }
        }
        if (hasMatch) break;
      }
      if (!hasMatch) continue;
    }
    
    // Filter by segment (skip if already used as primary filter)
    if (params.segment && !params.famille && !params.technology) {
      const normalized = normalizeSegment(params.segment);
      let hasMatch = false;
      for (const seg of offre.segments_cibles) {
        if (normalized.includes(seg.toUpperCase())) {
          hasMatch = true;
          break;
        }
      }
      if (!hasMatch) continue;
    }
    
    // Filter by clientType (skip if already used as primary filter)
    if (params.clientType && !params.famille && !params.technology && !params.segment) {
      const clientUpper = params.clientType.toUpperCase();
      const offreClient = offre.client_type.toUpperCase();
      if (offreClient !== clientUpper && offreClient !== 'B2C_B2B') {
        continue;
      }
    }
    
    // Boolean filters - fast checks
    if (params.isLocataire !== undefined && offre.locataire !== params.isLocataire) continue;
    if (params.isConventionne !== undefined && offre.conventionne !== params.isConventionne) continue;
    
    // Engagement filters
    if (params.hasEngagement !== undefined) {
      const hasEng = offre.engagement_mois != null && offre.engagement_mois > 0;
      if (hasEng !== params.hasEngagement) continue;
    }
    
    if (params.maxEngagementMois !== undefined && 
        offre.engagement_mois != null && 
        offre.engagement_mois > params.maxEngagementMois) {
      continue;
    }
    
    // Debit filter
    if (params.minDebit && offre.debits_eligibles) {
      const maxDebit = offre.debits_eligibles.debit_initial_max_mbps || 0;
      if (maxDebit < params.minDebit) continue;
    }
    
    // Price filter - check tableaux_tarifaires
    if (params.maxPrice) {
      let hasAffordable = false;
      for (const tableau of offre.tableaux_tarifaires) {
        for (const ligne of tableau.lignes) {
          const prix = ligne.tarif_nouveau_da || ligne.tarif_actuel_da || 0;
          if (prix > 0 && prix <= params.maxPrice) {
            hasAffordable = true;
            break;
          }
        }
        if (hasAffordable) break;
      }
      if (!hasAffordable) continue;
    }
    
    results.push(offre);
  }
  
  return results;
};

export const searchOffresReferentiel = memoizeLRU(
  _searchOffresReferentiel,
  100,
  (params) => createSearchKey(params)
);

/**
 * Get offre details by ID - O(1)
 */
export async function getOffreDetails(idOffre: string): Promise<OffreReferentiel | null> {
  return await getOffreById(idOffre);
}

/**
 * Get tarification for an offre
 */
export async function getOffreTarifs(idOffre: string): Promise<{
  offre: OffreReferentiel | null;
  tableaux: TableauTarifaire[];
}> {
  const offre = await getOffreById(idOffre);
  return {
    offre,
    tableaux: offre?.tableaux_tarifaires || [],
  };
}

/**
 * Check if user is eligible for an offre
 */
export async function checkOffreEligibility(params: {
  idOffre: string;
  isLocataire?: boolean;
  isConventionne?: boolean;
  segment?: string;
  sousSegment?: string;
}): Promise<{
  eligible: boolean;
  reasons: string[];
  offre: OffreReferentiel | null;
}> {
  const offre = await getOffreById(params.idOffre);
  
  if (!offre) {
    return { eligible: false, reasons: ['Offre introuvable'], offre: null };
  }
  
  const reasons: string[] = [];
  
  // Check exclusions
  if (params.isConventionne && offre.types_clients_exclus.includes('CONVENTIONNES')) {
    reasons.push('Clients conventionnés exclus de cette offre');
  }
  
  if (params.isLocataire && offre.types_clients_exclus.includes('LOCATAIRES')) {
    reasons.push('Clients locataires exclus de cette offre');
  }
  
  // Check locataire flag
  if (offre.locataire === true && !params.isLocataire) {
    reasons.push('Cette offre est réservée aux locataires');
  }
  
  if (offre.locataire === false && params.isLocataire) {
    reasons.push('Cette offre n\'est pas disponible pour les locataires');
  }
  
  // Check segment
  if (params.segment) {
    const normalized = normalizeSegment(params.segment);
    const hasMatch = offre.segments_cibles.some(s => 
      normalized.some(n => s.toUpperCase() === n)
    );
    if (!hasMatch) {
      reasons.push(`Cette offre n'est pas disponible pour le segment ${params.segment}`);
    }
  }
  
  // Check sous-segment
  if (params.sousSegment && offre.sous_segments.length > 0) {
    const sousSegUpper = params.sousSegment.toUpperCase();
    if (!offre.sous_segments.some(s => s.toUpperCase().includes(sousSegUpper))) {
      reasons.push(`Sous-segment ${params.sousSegment} non éligible`);
    }
  }
  
  if (reasons.length === 0) {
    return {
      eligible: true,
      reasons: ['✓ Éligible à cette offre'],
      offre,
    };
  }
  
  return { eligible: false, reasons, offre };
}

/**
 * Compare multiple offres - OPTIMIZED with early exit
 */
export async function compareOffresReferentiel(idOffres: string[]): Promise<{
  offres: OffreReferentiel[];
  comparison: Array<{
    id_offre: string;
    nom_commercial: string;
    famille: string;
    technologies: string[];
    engagement_mois: number | null;
    avantages_count: number;
    limitations_count: number;
    has_produits_offerts: boolean;
    prix_min: number | null;
    prix_max: number | null;
  }>;
}> {
  const offresPromises = idOffres.map(id => getOffreById(id));
  const offresResults = await Promise.all(offresPromises);
  const offres = offresResults.filter((o): o is OffreReferentiel => o !== null);
  
  // Early exit if no valid offres
  if (offres.length === 0) {
    return { offres: [], comparison: [] };
  }
  
  const comparison = offres.map(offre => {
    let prixMin: number | null = null;
    let prixMax: number | null = null;
    
    // Calculate min/max prices with early break
    for (const tableau of offre.tableaux_tarifaires) {
      for (const ligne of tableau.lignes) {
        const prix = ligne.tarif_nouveau_da || ligne.tarif_actuel_da;
        if (prix !== undefined && prix > 0) {
          if (prixMin === null || prix < prixMin) prixMin = prix;
          if (prixMax === null || prix > prixMax) prixMax = prix;
        }
      }
    }
    
    // Check for free products with early exit
    let hasProduitsOfferts = false;
    for (const produit of offre.produits_associes) {
      if (produit.tarif_nouveau_da_ttc === 0 || 
          produit.conditions?.some(c => c.toLowerCase().includes('offert'))) {
        hasProduitsOfferts = true;
        break;
      }
    }
    
    return {
      id_offre: offre.id_offre,
      nom_commercial: offre.nom_commercial,
      famille: offre.famille,
      technologies: offre.technologies,
      engagement_mois: offre.engagement_mois ?? null,
      avantages_count: offre.avantages_principaux.length,
      limitations_count: offre.limitations.length,
      has_produits_offerts: hasProduitsOfferts,
      prix_min: prixMin,
      prix_max: prixMax,
    };
  });
  
  return { offres, comparison };
}

/**
 * Get documents required for an offre
 */
export async function getOffreDocuments(idOffre: string): Promise<{
  offre: OffreReferentiel | null;
  documents: string[];
  modes_paiement: string[];
  canaux_activation: string[];
}> {
  const offre = await getOffreById(idOffre);
  return {
    offre,
    documents: offre?.documents_a_fournir || [],
    modes_paiement: offre?.modes_paiement || [],
    canaux_activation: offre?.canaux_activation || [],
  };
}

/**
 * List all available familles (categories)
 */
export async function listFamilles(): Promise<string[]> {
  await loadOffres();
  return Array.from(indexByFamille?.keys() || []);
}

/**
 * List all available technologies
 */
export async function listTechnologies(): Promise<string[]> {
  await loadOffres();
  return Array.from(indexByTechnology?.keys() || []);
}

/**
 * List all available segments
 */
export async function listSegments(): Promise<string[]> {
  await loadOffres();
  return Array.from(indexBySegment?.keys() || []);
}
