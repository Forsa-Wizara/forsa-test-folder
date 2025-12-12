// ============================================================================
// OFFRES RÉFÉRENTIEL - Search & Filter Functions
// Optimized with O(1) lookups and indexed access
// ============================================================================

import { z } from 'zod';
import fs from 'fs';
import path from 'path';

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
 * Load offres from JSON file (cached after first load)
 */
export function loadOffres(): OffreReferentiel[] {
  if (offresCache !== null) {
    return offresCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'offres.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rawData = JSON.parse(fileContent);
    
    // Validate with Zod
    const data = OffresDataSchema.parse(rawData);
    offresCache = data.referentiel_offres;
    
    // Build indexes
    buildIndexes(offresCache);
    
    console.log(`✅ Loaded ${offresCache.length} offres from JSON`);
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
export function getOffreById(id: string): OffreReferentiel | null {
  loadOffres(); // Ensure loaded
  return indexById?.get(id) || null;
}

/**
 * Get offres by famille - O(1)
 */
export function getOffresByFamille(famille: string): OffreReferentiel[] {
  loadOffres();
  return indexByFamille?.get(famille.toUpperCase()) || [];
}

/**
 * Get offres by technology - O(1)
 */
export function getOffresByTechnology(technology: string): OffreReferentiel[] {
  loadOffres();
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
export function getOffresByClientType(clientType: string): OffreReferentiel[] {
  loadOffres();
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
export function getOffresBySegment(segment: string): OffreReferentiel[] {
  loadOffres();
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
 * Search offres with multiple filters - OPTIMIZED
 */
export function searchOffresReferentiel(params: SearchOffresParams): OffreReferentiel[] {
  let candidates: OffreReferentiel[];
  
  // Use the most selective index first
  if (params.famille) {
    candidates = getOffresByFamille(params.famille);
  } else if (params.technology) {
    candidates = getOffresByTechnology(params.technology);
  } else if (params.segment) {
    const normalized = normalizeSegment(params.segment);
    candidates = normalized.flatMap(s => getOffresBySegment(s));
  } else if (params.clientType) {
    candidates = getOffresByClientType(params.clientType);
  } else {
    candidates = loadOffres();
  }
  
  // Apply remaining filters with early exit
  const results: OffreReferentiel[] = [];
  
  for (const offre of candidates) {
    // Filter by nom (fuzzy)
    if (params.nom) {
      const searchLower = params.nom.toLowerCase();
      if (!offre.nom_commercial.toLowerCase().includes(searchLower) &&
          !offre.id_offre.toLowerCase().includes(searchLower)) {
        continue;
      }
    }
    
    // Filter by sous_famille
    if (params.sousFamille && 
        !offre.sous_famille.toUpperCase().includes(params.sousFamille.toUpperCase())) {
      continue;
    }
    
    // Filter by technology (if not already filtered)
    if (params.technology && !params.famille) {
      const normalized = normalizeTech(params.technology);
      const hasMatch = offre.technologies.some(t => 
        normalized.some(n => t.toUpperCase().includes(n))
      );
      if (!hasMatch) continue;
    }
    
    // Filter by segment (if not already filtered)
    if (params.segment && !params.famille && !params.technology) {
      const normalized = normalizeSegment(params.segment);
      const hasMatch = offre.segments_cibles.some(s => 
        normalized.some(n => s.toUpperCase() === n)
      );
      if (!hasMatch) continue;
    }
    
    // Filter by clientType (if not already filtered)
    if (params.clientType && !params.famille && !params.technology && !params.segment) {
      const clientUpper = params.clientType.toUpperCase();
      if (offre.client_type.toUpperCase() !== clientUpper && 
          offre.client_type.toUpperCase() !== 'B2C_B2B') {
        continue;
      }
    }
    
    // Filter by locataire
    if (params.isLocataire !== undefined && offre.locataire !== params.isLocataire) {
      continue;
    }
    
    // Filter by conventionne
    if (params.isConventionne !== undefined && offre.conventionne !== params.isConventionne) {
      continue;
    }
    
    // Filter by engagement
    if (params.hasEngagement !== undefined) {
      const hasEng = offre.engagement_mois != null && offre.engagement_mois > 0;
      if (hasEng !== params.hasEngagement) continue;
    }
    
    if (params.maxEngagementMois !== undefined && 
        offre.engagement_mois != null && 
        offre.engagement_mois > params.maxEngagementMois) {
      continue;
    }
    
    // Filter by min debit
    if (params.minDebit && offre.debits_eligibles) {
      const maxDebit = offre.debits_eligibles.debit_initial_max_mbps || 0;
      if (maxDebit < params.minDebit) continue;
    }
    
    // Filter by max price (check tableaux_tarifaires)
    if (params.maxPrice) {
      const hasAffordable = offre.tableaux_tarifaires.some(tableau =>
        tableau.lignes.some(ligne => {
          const prix = ligne.tarif_nouveau_da || ligne.tarif_actuel_da || 0;
          return prix > 0 && prix <= params.maxPrice!;
        })
      );
      if (!hasAffordable) continue;
    }
    
    results.push(offre);
  }
  
  return results;
}

/**
 * Get offre details by ID - O(1)
 */
export function getOffreDetails(idOffre: string): OffreReferentiel | null {
  return getOffreById(idOffre);
}

/**
 * Get tarification for an offre
 */
export function getOffreTarifs(idOffre: string): {
  offre: OffreReferentiel | null;
  tableaux: TableauTarifaire[];
} {
  const offre = getOffreById(idOffre);
  return {
    offre,
    tableaux: offre?.tableaux_tarifaires || [],
  };
}

/**
 * Check if user is eligible for an offre
 */
export function checkOffreEligibility(params: {
  idOffre: string;
  isLocataire?: boolean;
  isConventionne?: boolean;
  segment?: string;
  sousSegment?: string;
}): {
  eligible: boolean;
  reasons: string[];
  offre: OffreReferentiel | null;
} {
  const offre = getOffreById(params.idOffre);
  
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
 * Compare multiple offres
 */
export function compareOffresReferentiel(idOffres: string[]): {
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
} {
  const offres = idOffres
    .map(id => getOffreById(id))
    .filter((o): o is OffreReferentiel => o !== null);
  
  const comparison = offres.map(offre => {
    // Calculate min/max prices
    let prixMin: number | null = null;
    let prixMax: number | null = null;
    
    for (const tableau of offre.tableaux_tarifaires) {
      for (const ligne of tableau.lignes) {
        const prix = ligne.tarif_nouveau_da || ligne.tarif_actuel_da;
        if (prix !== undefined && prix > 0) {
          if (prixMin === null || prix < prixMin) prixMin = prix;
          if (prixMax === null || prix > prixMax) prixMax = prix;
        }
      }
    }
    
    // Check for free products
    const hasProduitsOfferts = offre.produits_associes.some(
      p => p.tarif_nouveau_da_ttc === 0 || 
           p.conditions?.some(c => c.toLowerCase().includes('offert'))
    );
    
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
export function getOffreDocuments(idOffre: string): {
  offre: OffreReferentiel | null;
  documents: string[];
  modes_paiement: string[];
  canaux_activation: string[];
} {
  const offre = getOffreById(idOffre);
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
export function listFamilles(): string[] {
  loadOffres();
  return Array.from(indexByFamille?.keys() || []);
}

/**
 * List all available technologies
 */
export function listTechnologies(): string[] {
  loadOffres();
  return Array.from(indexByTechnology?.keys() || []);
}

/**
 * List all available segments
 */
export function listSegments(): string[] {
  loadOffres();
  return Array.from(indexBySegment?.keys() || []);
}
