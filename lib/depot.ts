// ============================================================================
// DÉPÔTS VENTE RÉFÉRENTIEL - Search & Filter Functions
// Optimized with O(1) lookups and indexed access
// Adapted for new depot.json structure (smartphones, box TV, e-learning, accessories)
// ============================================================================

import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { getCurrentLanguage } from './language-context';

// ============================================================================
// ZOD SCHEMAS & TYPES
// ============================================================================

// Specifications can vary by product type
export const SpecificationsSchema = z.object({
  // Smartphones
  ram_go: z.number().optional(),
  ram_dynamic_go: z.number().optional(),
  stockage_go: z.number().optional(),
  batterie_mah: z.number().optional(),
  ecran_pouces: z.number().optional(),
  ecran_type: z.string().optional(),
  taux_rafraichissement_hz: z.number().optional(),
  camera_mp: z.string().optional(),
  processeur: z.string().optional(),
  wifi_standard: z.string().optional(),
  design: z.string().optional(),
  // Box TV
  os: z.string().optional(),
  stockage_gb: z.number().optional(),
  fonctionnalites: z.array(z.string()).optional(),
  // E-learning platforms
  nombre_eleves_max: z.number().optional(),
  cours_en_ligne: z.number().optional(),
  cours_presentiels: z.number().optional(),
  blogs: z.number().optional(),
  pages_perso: z.number().optional(),
  utilisateurs: z.object({
    formateurs: z.number().optional(),
    employes: z.number().optional(),
    administrateurs: z.number().optional(),
  }).optional(),
  // EKOTEB
  nombre_livres_disponibles: z.number().optional(),
  nombre_categories: z.number().optional(),
  ebooks_simultanees: z.number().optional(),
  livres_audio_simultanees: z.number().optional(),
  langue_contenu: z.string().optional(),
  langues_interface: z.array(z.string()).optional(),
  acces_platforms: z.array(z.string()).optional(),
  mode_lecture: z.string().optional(),
  // Dorouscom
  code_longueur: z.number().optional(),
  validite_avant_activation: z.string().optional(),
  type_contenu: z.string().optional(),
  nombre_enseignants: z.number().optional(),
  niveaux: z.array(z.string()).optional(),
  programmes: z.string().optional(),
  // MOALIM
  activites_adaptatives: z.number().optional(),
  basee_sur: z.string().optional(),
  conception: z.string().optional(),
  apprentissage: z.string().optional(),
  disponibilite: z.string().optional(),
  // Idoom Market
  type_produits: z.string().optional(),
  modalites: z.array(z.string()).optional(),
  suivi: z.string().optional(),
}).passthrough();

// SAV procedure
export const SAVProcedureSchema = z.object({
  sous_garantie: z.string().optional(),
  garantie: z.string().optional(),
  hors_garantie: z.string().optional(),
  delais_moyens_jours: z.string().optional(),
  delais: z.string().optional(),
}).passthrough();

// Contact SAV can be string or object
export const ContactSAVSchema = z.union([
  z.string(),
  z.object({
    telephone: z.union([z.string(), z.array(z.string())]).optional(),
    email: z.string().optional(),
  }),
]);

// Tarification for e-learning
export const TarificationSchema = z.object({
  periode: z.string().optional(),
  type: z.string().optional(),
  prix_da: z.number().optional(),
  nom: z.string().optional(),
  appareils: z.number().optional(),
  ecrans: z.number().optional(),
  data_go: z.number().optional(),
  validite_jours: z.number().optional(),
  duree_mois: z.number().optional(),
  periodicite: z.union([z.string(), z.array(z.string())]).optional(),
});

// Reclamations
export const ReclamationsSchema = z.object({
  canal: z.string().optional(),
  contact: z.string().optional(),
  documents_requis: z.array(z.string()).optional(),
});

// Politique retour
export const PolitiqueRetourSchema = z.object({
  delai_signalement: z.string().optional(),
  lieu: z.string().optional(),
  remboursement_conditions: z.array(z.string()).optional(),
  delai_remboursement_max_jours: z.number().optional(),
  remplacement_possible: z.string().optional(),
});

// Livraison
export const LivraisonSchema = z.object({
  statut: z.string().optional(),
  operateur: z.string().optional(),
  affichage: z.string().optional(),
});

// Acces
export const AccesSchema = z.union([
  z.string(),
  z.object({
    methode: z.string().optional(),
    inscription: z.string().optional(),
    plateformes: z.array(z.string()).optional(),
  }),
]);

// Main product schema
export const DepotVenteSchema = z.object({
  id_produit: z.string(),
  nom_produit: z.string(),
  categorie: z.string(),
  type_produit: z.string(),
  
  // Optional fields that vary by product
  marque: z.string().optional(),
  modele: z.string().optional(),
  partenaire: z.string().optional(),
  reference_document: z.string().optional(),
  specifications: SpecificationsSchema.optional(),
  couleurs: z.array(z.string()).optional(),
  segments_cibles: z.array(z.string()).optional(),
  
  // Pricing - various formats
  prix_ttc_da: z.number().optional(),
  prix_ancien_ttc_da: z.number().optional(),
  prix_nouveau_ttc_da: z.number().optional(),
  reduction_percentage: z.number().optional(),
  economie_da: z.number().optional(),
  validite_jours: z.number().optional(),
  validite_mois: z.number().optional(),
  
  // Sales channels
  canaux_vente: z.array(z.string()).optional(),
  
  // Warranty & SAV
  garantie_mois: z.number().optional(),
  sav_partenaire: z.string().optional(),
  contact_sav: ContactSAVSchema.optional(),
  accessoires_inclus: z.array(z.string()).optional(),
  couverture_garantie: z.array(z.string()).optional(),
  sav_procedure: SAVProcedureSchema.optional(),
  
  // E-learning specific
  tarification: z.array(TarificationSchema).optional(),
  avantages: z.array(z.string()).optional(),
  avantages_cles: z.array(z.string()).optional(),
  avantages_principaux: z.array(z.string()).optional(),
  
  // TWIN BOX specific
  disponibilite_sim: z.string().optional(),
  services_associes: z.array(z.string()).optional(),
  abonnements_tod: z.array(TarificationSchema).optional(),
  abonnements_fennec_digital: z.array(TarificationSchema).optional(),
  modes_paiement: z.array(z.string()).optional(),
  
  // Accessoires (cache modem)
  format: z.string().optional(),
  materiau: z.string().optional(),
  epaisseur_mm: z.number().optional(),
  finitions_disponibles: z.array(z.string()).optional(),
  destination_modem: z.string().optional(),
  systeme_aeration: z.string().optional(),
  installation: z.string().optional(),
  points_forts: z.array(z.string()).optional(),
  reclamations: ReclamationsSchema.optional(),
  
  // E-learning additional
  plateforme: z.string().optional(),
  url_plateforme: z.string().optional(),
  categories: z.array(z.string()).optional(),
  fonctionnalites: z.array(z.string()).optional(),
  acces: AccesSchema.optional(),
  contact_support: z.object({
    email: z.string().optional(),
    telephone: z.union([z.string(), z.array(z.string())]).optional(),
    website: z.string().optional(),
  }).optional(),
  types_abonnement: z.array(z.any()).optional(),
  cumulabilite: z.string().optional(),
  solde_restant: z.string().optional(),
  politique_remboursement: z.any().optional(),
  type_contenu: z.string().optional(),
  niveaux_cibles: z.array(z.string()).optional(),
  specialisation: z.string().optional(),
  langues_disponibles: z.array(z.string()).optional(),
  matieres_disponibles: z.array(z.string()).optional(),
  procedure_achat: z.array(z.string()).optional(),
  livraison: LivraisonSchema.optional(),
  politique_retour: PolitiqueRetourSchema.optional(),
  
  // Notes
  notes: z.array(z.string()).optional(),
}).passthrough();

export const DepotsDataSchema = z.object({
  referentiel_produits_depot_vente: z.array(DepotVenteSchema),
});

export type Specifications = z.infer<typeof SpecificationsSchema>;
export type TarificationDepot = z.infer<typeof TarificationSchema>;
export type DepotVente = z.infer<typeof DepotVenteSchema>;

// ============================================================================
// CACHE & INDEXES - O(1) Lookups
// ============================================================================

let depotsCache: DepotVente[] | null = null;
let indexById: Map<string, DepotVente> | null = null;
let indexByCategorie: Map<string, DepotVente[]> | null = null;
let indexByTypeProduit: Map<string, DepotVente[]> | null = null;
let indexByMarque: Map<string, DepotVente[]> | null = null;
let indexBySegment: Map<string, DepotVente[]> | null = null;
let indexByPartenaire: Map<string, DepotVente[]> | null = null;

// ============================================================================
// INVERTED INDEX DATA STRUCTURES - RECHERCHES ULTRA-RAPIDES O(1)
// ============================================================================

interface InvertedIndexesDepots {
  // Keyword indexes - ex: "e-learning" -> Set<id_produit>
  keywords: Map<string, Set<string>>;
  
  // Specifications buckets
  ramBuckets: Map<string, Set<string>>; // "4-6", "8-10", "12+"
  stockageBuckets: Map<string, Set<string>>; // "64", "128", "256", "512+"
  batterieBuckets: Map<string, Set<string>>; // "4000-5000", "5001-6000", "6000+"
  
  // Couleurs index - ex: "Noir" -> Set<id_produit>
  couleurs: Map<string, Set<string>>;
  
  // Garantie buckets - ex: "12" -> Set<id_produit>
  garantieBuckets: Map<string, Set<string>>;
  
  // Reduction flag
  hasReduction: Set<string>;
  
  // Price buckets
  priceBuckets: Map<string, Set<string>>;
}

let invertedIndexesDepots: InvertedIndexesDepots | null = null;

/**
 * Load depots from JSON file (cached after first load)
 * Uses the global language context if no language parameter is provided
 */
export function loadDepots(): DepotVente[] {
  // Récupère la langue depuis le contexte global
  const language = getCurrentLanguage();
  
  try {
    const filename = language === 'ar' ? 'arDepot.json' : 'depot.json';
    const filePath = path.join(process.cwd(), 'data', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File ${filename} not found, falling back to depot.json`);
      const fallbackPath = path.join(process.cwd(), 'data', 'depot.json');
      const fileContent = fs.readFileSync(fallbackPath, 'utf-8');
      const rawData = JSON.parse(fileContent);
      const data = DepotsDataSchema.parse(rawData);
      buildIndexes(data.referentiel_produits_depot_vente);
      return data.referentiel_produits_depot_vente;
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rawData = JSON.parse(fileContent);
    
    // Validate with Zod
    const data = DepotsDataSchema.parse(rawData);
    depotsCache = data.referentiel_produits_depot_vente;
    
    // Build indexes
    buildIndexes(depotsCache);
    
    console.log(`✅ Loaded ${depotsCache.length} produits dépôt-vente from ${filename}`);
    return depotsCache;
  } catch (error) {
    console.error('❌ Error loading depots:', error);
    throw new Error('Failed to load depots data');
  }
}


/**
 * Build all indexes for O(1) lookups + INVERTED INDEXES for ultra-fast searches
 */
function buildIndexes(depots: DepotVente[]): void {
  // Existing indexes
  indexById = new Map();
  indexByCategorie = new Map();
  indexByTypeProduit = new Map();
  indexByMarque = new Map();
  indexBySegment = new Map();
  indexByPartenaire = new Map();
  
  // Initialize inverted indexes
  invertedIndexesDepots = {
    keywords: new Map(),
    ramBuckets: new Map(),
    stockageBuckets: new Map(),
    batterieBuckets: new Map(),
    couleurs: new Map(),
    garantieBuckets: new Map(),
    hasReduction: new Set(),
    priceBuckets: new Map(),
  };
  
  for (const depot of depots) {
    const produitId = depot.id_produit;
    
    // ===== EXISTING INDEXES =====
    indexById.set(produitId, depot);
    
    // Index by categorie
    const catKey = depot.categorie.toUpperCase();
    if (!indexByCategorie.has(catKey)) {
      indexByCategorie.set(catKey, []);
    }
    indexByCategorie.get(catKey)!.push(depot);
    
    // Index by type_produit
    const typeKey = depot.type_produit.toUpperCase();
    if (!indexByTypeProduit.has(typeKey)) {
      indexByTypeProduit.set(typeKey, []);
    }
    indexByTypeProduit.get(typeKey)!.push(depot);
    
    // Index by marque (if exists)
    if (depot.marque) {
      const marqueKey = depot.marque.toUpperCase();
      if (!indexByMarque.has(marqueKey)) {
        indexByMarque.set(marqueKey, []);
      }
      indexByMarque.get(marqueKey)!.push(depot);
    }
    
    // Index by segment
    if (depot.segments_cibles) {
      for (const segment of depot.segments_cibles) {
        const segmentKey = segment.toUpperCase();
        if (!indexBySegment.has(segmentKey)) {
          indexBySegment.set(segmentKey, []);
        }
        indexBySegment.get(segmentKey)!.push(depot);
      }
    }
    
    // Index by partenaire
    if (depot.partenaire) {
      const partenaireKey = depot.partenaire.toUpperCase();
      if (!indexByPartenaire.has(partenaireKey)) {
        indexByPartenaire.set(partenaireKey, []);
      }
      indexByPartenaire.get(partenaireKey)!.push(depot);
    }
    
    // ===== INVERTED INDEXES =====
    
    // 1. Keywords extraction
    const keywords = extractDepotKeywords(depot);
    for (const keyword of keywords) {
      if (!invertedIndexesDepots.keywords.has(keyword)) {
        invertedIndexesDepots.keywords.set(keyword, new Set());
      }
      invertedIndexesDepots.keywords.get(keyword)!.add(produitId);
    }
    
    // 2. Specifications buckets
    if (depot.specifications) {
      // RAM bucket
      if (depot.specifications.ram_go) {
        const ramBucket = getRamBucket(depot.specifications.ram_go);
        if (!invertedIndexesDepots.ramBuckets.has(ramBucket)) {
          invertedIndexesDepots.ramBuckets.set(ramBucket, new Set());
        }
        invertedIndexesDepots.ramBuckets.get(ramBucket)!.add(produitId);
      }
      
      // Stockage bucket
      if (depot.specifications.stockage_go) {
        const stockBucket = getStockageBucket(depot.specifications.stockage_go);
        if (!invertedIndexesDepots.stockageBuckets.has(stockBucket)) {
          invertedIndexesDepots.stockageBuckets.set(stockBucket, new Set());
        }
        invertedIndexesDepots.stockageBuckets.get(stockBucket)!.add(produitId);
      }
      
      // Batterie bucket
      if (depot.specifications.batterie_mah) {
        const battBucket = getBatterieBucket(depot.specifications.batterie_mah);
        if (!invertedIndexesDepots.batterieBuckets.has(battBucket)) {
          invertedIndexesDepots.batterieBuckets.set(battBucket, new Set());
        }
        invertedIndexesDepots.batterieBuckets.get(battBucket)!.add(produitId);
      }
    }
    
    // 3. Couleurs index
    if (depot.couleurs) {
      for (const couleur of depot.couleurs) {
        const couleurKey = couleur.toLowerCase();
        if (!invertedIndexesDepots.couleurs.has(couleurKey)) {
          invertedIndexesDepots.couleurs.set(couleurKey, new Set());
        }
        invertedIndexesDepots.couleurs.get(couleurKey)!.add(produitId);
      }
    }
    
    // 4. Garantie bucket
    if (depot.garantie_mois) {
      const garantieBucket = depot.garantie_mois.toString();
      if (!invertedIndexesDepots.garantieBuckets.has(garantieBucket)) {
        invertedIndexesDepots.garantieBuckets.set(garantieBucket, new Set());
      }
      invertedIndexesDepots.garantieBuckets.get(garantieBucket)!.add(produitId);
    }
    
    // 5. Reduction flag
    if (depot.reduction_percentage && depot.reduction_percentage > 0) {
      invertedIndexesDepots.hasReduction.add(produitId);
    }
    
    // 6. Price buckets
    const prix = depot.prix_ttc_da || depot.prix_nouveau_ttc_da;
    if (prix) {
      const priceBucket = getPriceBucketDepots(prix);
      if (!invertedIndexesDepots.priceBuckets.has(priceBucket)) {
        invertedIndexesDepots.priceBuckets.set(priceBucket, new Set());
      }
      invertedIndexesDepots.priceBuckets.get(priceBucket)!.add(produitId);
    }
  }
  
  console.log(`📊 Inverted indexes depots built:
    - Keywords: ${invertedIndexesDepots.keywords.size} unique terms
    - RAM buckets: ${invertedIndexesDepots.ramBuckets.size} ranges
    - Stockage buckets: ${invertedIndexesDepots.stockageBuckets.size} ranges
    - Couleurs: ${invertedIndexesDepots.couleurs.size} colors
    - Has reduction: ${invertedIndexesDepots.hasReduction.size} produits`);
}

/**
 * Extract searchable keywords from depot product
 */
function extractDepotKeywords(depot: DepotVente): Set<string> {
  const keywords = new Set<string>();
  
  // Combine all searchable text
  const allText = [
    depot.nom_produit,
    depot.categorie,
    depot.type_produit,
    depot.marque || '',
    depot.modele || '',
    depot.partenaire || '',
    ...(depot.avantages || []),
    ...(depot.avantages_cles || []),
    ...(depot.avantages_principaux || []),
    ...(depot.points_forts || []),
    ...(depot.notes || []),
  ].join(' ').toLowerCase();
  
  // Keywords basés sur analyse des données réelles
  const patterns = [
    'smartphone', 'box tv', 'android tv', 'twin box',
    'e-learning', 'classateck', 'ekoteb', 'moalim', 'dorouscom',
    'cache modem', 'accessoire', 'coque', 'verre trempé',
    'garantie', 'sav', 'khadamty', 'yalidine', 'sacomi',
    'ram', 'stockage', 'batterie', 'camera', 'écran',
    'processeur', 'wifi', 'os', 'android',
    'finitions premium', 'livraison', 'retour', 'remboursement',
    'cours en ligne', 'ebooks', 'livres audio', 'lms',
    'formation', 'enseignants', 'niveaux', 'programmes',
    'buzz', 'zte', 'nubia', 'ace algérie',
    'noir', 'bleu', 'doré', 'design moderne',
  ];
  
  for (const pattern of patterns) {
    if (allText.includes(pattern)) {
      keywords.add(pattern);
    }
  }
  
  return keywords;
}

/**
 * Get RAM bucket
 */
function getRamBucket(ramGo: number): string {
  if (ramGo <= 6) return '4-6';
  if (ramGo <= 10) return '8-10';
  return '12+';
}

/**
 * Get stockage bucket
 */
function getStockageBucket(stockageGo: number): string {
  if (stockageGo <= 64) return '64';
  if (stockageGo <= 128) return '128';
  if (stockageGo <= 256) return '256';
  return '512+';
}

/**
 * Get batterie bucket
 */
function getBatterieBucket(batterieMah: number): string {
  if (batterieMah <= 5000) return '4000-5000';
  if (batterieMah <= 6000) return '5001-6000';
  return '6000+';
}

/**
 * Get price bucket for depots
 */
function getPriceBucketDepots(price: number): string {
  if (price <= 1000) return '0-1000';
  if (price <= 2000) return '1001-2000';
  if (price <= 3000) return '2001-3000';
  if (price <= 4000) return '3001-4000';
  if (price <= 10000) return '4001-10000';
  if (price <= 20000) return '10001-20000';
  return '20001+';
}

// ============================================================================
// O(1) LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get depot by ID - O(1)
 */
export function getDepotById(id: string): DepotVente | null {
  loadDepots();
  return indexById?.get(id) || null;
}

/**
 * Get depots by categorie - O(1)
 */
export function getDepotsByCategorie(categorie: string): DepotVente[] {
  loadDepots();
  return indexByCategorie?.get(categorie.toUpperCase()) || [];
}

/**
 * Get depots by type_produit - O(1)
 */
export function getDepotsByTypeProduit(typeProduit: string): DepotVente[] {
  loadDepots();
  return indexByTypeProduit?.get(typeProduit.toUpperCase()) || [];
}

/**
 * Get depots by marque - O(1)
 */
export function getDepotsByMarque(marque: string): DepotVente[] {
  loadDepots();
  return indexByMarque?.get(marque.toUpperCase()) || [];
}

/**
 * Get depots by segment - O(1)
 */
export function getDepotsBySegment(segment: string): DepotVente[] {
  loadDepots();
  return indexBySegment?.get(segment.toUpperCase()) || [];
}

/**
 * Get depots by partenaire - O(1)
 */
export function getDepotsByPartenaire(partenaire: string): DepotVente[] {
  loadDepots();
  // Fuzzy match on partenaire
  const search = partenaire.toUpperCase();
  const results: DepotVente[] = [];
  if (indexByPartenaire) {
    for (const [key, depots] of indexByPartenaire.entries()) {
      if (key.includes(search)) {
        results.push(...depots);
      }
    }
  }
  return results;
}

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize categorie terms
 */
function normalizeCategorie(term: string): string[] {
  const termLower = term.toLowerCase().trim();
  
  const mappings: Record<string, string[]> = {
    'smartphone': ['SMARTPHONES'],
    'smartphones': ['SMARTPHONES'],
    'telephone': ['SMARTPHONES'],
    'téléphone': ['SMARTPHONES'],
    'mobile': ['SMARTPHONES'],
    'box': ['HARDWARE_MULTIMEDIA'],
    'tv': ['HARDWARE_MULTIMEDIA'],
    'android': ['HARDWARE_MULTIMEDIA'],
    'twin': ['HARDWARE_MULTIMEDIA'],
    'accessoire': ['ACCESSOIRES'],
    'accessoires': ['ACCESSOIRES'],
    'cache': ['ACCESSOIRES'],
    'modem': ['ACCESSOIRES'],
    'elearning': ['SOLUTIONS_ELEARNING'],
    'e-learning': ['SOLUTIONS_ELEARNING'],
    'formation': ['SOLUTIONS_ELEARNING'],
    'formations': ['SOLUTIONS_ELEARNING'],
    'education': ['SOLUTIONS_ELEARNING'],
    'scolaire': ['SOLUTIONS_ELEARNING'],
    'ebook': ['SOLUTIONS_ELEARNING'],
    'livre': ['SOLUTIONS_ELEARNING'],
    'digital': ['SERVICES_DIGITAUX'],
    'ecommerce': ['SERVICES_DIGITAUX'],
    'market': ['SERVICES_DIGITAUX'],
  };
  
  return mappings[termLower] || [term.toUpperCase()];
}

/**
 * Normalize segment terms
 */
function normalizeSegment(term: string): string[] {
  const termLower = term.toLowerCase().trim();
  
  const mappings: Record<string, string[]> = {
    'particulier': ['PARTICULIERS'],
    'particuliers': ['PARTICULIERS'],
    'residentiel': ['RESIDENTIEL'],
    'résidentiel': ['RESIDENTIEL'],
    'famille': ['FAMILLES'],
    'familles': ['FAMILLES'],
    'pro': ['PROFESSIONNELS'],
    'professionnel': ['PROFESSIONNELS'],
    'professionnels': ['PROFESSIONNELS'],
    'etudiant': ['ETUDIANTS', 'UNIVERSITAIRES'],
    'étudiants': ['ETUDIANTS', 'UNIVERSITAIRES'],
    'etudiants': ['ETUDIANTS', 'UNIVERSITAIRES'],
    'enseignant': ['ENSEIGNANTS', 'FORMATEURS'],
    'enseignants': ['ENSEIGNANTS', 'FORMATEURS'],
    'formateur': ['FORMATEURS'],
    'ecole': ['PETITES_ECOLES', 'ECOLES_MOYENNES', 'GRANDES_ECOLES'],
    'école': ['PETITES_ECOLES', 'ECOLES_MOYENNES', 'GRANDES_ECOLES'],
    'universite': ['UNIVERSITES'],
    'université': ['UNIVERSITES'],
    'eleve': ['ELEVES', 'ELEVES_PRIMAIRE', 'ELEVES_COLLEGE', 'ELEVES_LYCEE'],
    'élève': ['ELEVES', 'ELEVES_PRIMAIRE', 'ELEVES_COLLEGE', 'ELEVES_LYCEE'],
    'parent': ['PARENTS'],
    'entreprise': ['ENTREPRISES'],
    'tech': ['TECH_ENTHUSIASTS'],
  };
  
  return mappings[termLower] || [term.toUpperCase()];
}

/**
 * Normalize marque terms
 */
function normalizeMarque(term: string): string[] {
  const termLower = term.toLowerCase().trim();
  
  const mappings: Record<string, string[]> = {
    'zte': ['ZTE', 'ZTE NUBIA'],
    'nubia': ['ZTE NUBIA'],
    'buzz': ['BUZZ'],
    'twin': ['TWIN BOX'],
    'twinbox': ['TWIN BOX'],
  };
  
  return mappings[termLower] || [term.toUpperCase()];
}
/**
 * Clear cache
 */
export function clearDepotsCache(): void {
  depotsCache = null;
  indexById = null;
  indexByCategorie = null;
  indexByTypeProduit = null;
  indexByMarque = null;
  indexBySegment = null;
  indexByPartenaire = null;
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the main price for a product (handles different price fields)
 */
export function getProductPrice(depot: DepotVente): {
  prix_principal: number | null;
  prix_ancien: number | null;
  reduction_percentage: number | null;
  economie_da: number | null;
} {
  // Direct price
  if (depot.prix_ttc_da) {
    return {
      prix_principal: depot.prix_ttc_da,
      prix_ancien: null,
      reduction_percentage: null,
      economie_da: null,
    };
  }
  
  // New price with discount (TWIN BOX)
  if (depot.prix_nouveau_ttc_da) {
    return {
      prix_principal: depot.prix_nouveau_ttc_da,
      prix_ancien: depot.prix_ancien_ttc_da ?? null,
      reduction_percentage: depot.reduction_percentage ?? null,
      economie_da: depot.economie_da ?? null,
    };
  }
  
  // E-learning with tarification array - return lowest
  if (depot.tarification && depot.tarification.length > 0) {
    const prices = depot.tarification
      .map(t => t.prix_da)
      .filter((p): p is number => p !== undefined);
    if (prices.length > 0) {
      return {
        prix_principal: Math.min(...prices),
        prix_ancien: null,
        reduction_percentage: null,
        economie_da: null,
      };
    }
  }
  
  return {
    prix_principal: null,
    prix_ancien: null,
    reduction_percentage: null,
    economie_da: null,
  };
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

export interface SearchDepotsParams {
  nom?: string;
  categorie?: string;
  typeProduit?: string;
  marque?: string;
  segment?: string;
  partenaire?: string;
  maxPrice?: number;
  hasReduction?: boolean;
}

/**
 * Search depots with multiple filters - OPTIMIZED
 */
export function searchDepotsVente(params: SearchDepotsParams): DepotVente[] {
  let candidates: DepotVente[];
  
  // Use the most selective index first
  if (params.marque) {
    const normalized = normalizeMarque(params.marque);
    candidates = normalized.flatMap(m => getDepotsByMarque(m));
  } else if (params.categorie) {
    const normalized = normalizeCategorie(params.categorie);
    candidates = normalized.flatMap(c => getDepotsByCategorie(c));
  } else if (params.typeProduit) {
    candidates = getDepotsByTypeProduit(params.typeProduit);
  } else if (params.segment) {
    const normalized = normalizeSegment(params.segment);
    candidates = normalized.flatMap(s => getDepotsBySegment(s));
  } else if (params.partenaire) {
    candidates = getDepotsByPartenaire(params.partenaire);
  } else {
    candidates = loadDepots();
  }
  
  // Remove duplicates
  const uniqueCandidates = [...new Set(candidates)];
  
  // Apply remaining filters with early exit
  const results: DepotVente[] = [];
  
  for (const depot of uniqueCandidates) {
    // Filter by nom (fuzzy)
    if (params.nom) {
      const searchLower = params.nom.toLowerCase();
      const matchNom = depot.nom_produit.toLowerCase().includes(searchLower);
      const matchId = depot.id_produit.toLowerCase().includes(searchLower);
      const matchMarque = depot.marque?.toLowerCase().includes(searchLower) ?? false;
      const matchModele = depot.modele?.toLowerCase().includes(searchLower) ?? false;
      const matchPartenaire = depot.partenaire?.toLowerCase().includes(searchLower) ?? false;
      
      if (!matchNom && !matchId && !matchMarque && !matchModele && !matchPartenaire) {
        continue;
      }
    }
    
    // Filter by type_produit (if not already indexed)
    if (params.typeProduit && !params.marque && !params.categorie && !params.segment && !params.partenaire) {
      // Already filtered by index
    } else if (params.typeProduit) {
      if (!depot.type_produit.toUpperCase().includes(params.typeProduit.toUpperCase())) {
        continue;
      }
    }
    
    // Filter by max price
    if (params.maxPrice) {
      const pricing = getProductPrice(depot);
      if (!pricing.prix_principal || pricing.prix_principal > params.maxPrice) {
        continue;
      }
    }
    
    // Filter by reduction
    if (params.hasReduction !== undefined) {
      const hasRed = (depot.reduction_percentage != null && depot.reduction_percentage > 0) ||
                     (depot.economie_da != null && depot.economie_da > 0);
      if (hasRed !== params.hasReduction) {
        continue;
      }
    }
    
    results.push(depot);
  }
  
  return results;
}

/**
 * Get depot details by ID - O(1)
 */
export function getDepotDetails(idProduit: string): DepotVente | null {
  return getDepotById(idProduit);
}

/**
 * Get pricing info for a depot
 */
export function getDepotTarifs(idProduit: string): {
  depot: DepotVente | null;
  prix_principal: number | null;
  prix_ancien: number | null;
  reduction_percentage: number | null;
  economie_da: number | null;
  tarification_options: TarificationDepot[] | null;
} {
  const depot = getDepotById(idProduit);
  if (!depot) {
    return {
      depot: null,
      prix_principal: null,
      prix_ancien: null,
      reduction_percentage: null,
      economie_da: null,
      tarification_options: null,
    };
  }
  
  const pricing = getProductPrice(depot);
  
  return {
    depot,
    prix_principal: pricing.prix_principal,
    prix_ancien: pricing.prix_ancien,
    reduction_percentage: pricing.reduction_percentage,
    economie_da: pricing.economie_da,
    tarification_options: depot.tarification ?? null,
  };
}

/**
 * Check if user is eligible for a depot product
 */
export function checkDepotEligibility(params: {
  idProduit: string;
  segment?: string;
}): {
  eligible: boolean;
  reasons: string[];
  depot: DepotVente | null;
  canaux_vente: string[];
} {
  const depot = getDepotById(params.idProduit);
  
  if (!depot) {
    return { eligible: false, reasons: ['Produit introuvable'], depot: null, canaux_vente: [] };
  }
  
  const reasons: string[] = [];
  
  // Check segment
  if (params.segment && depot.segments_cibles && depot.segments_cibles.length > 0) {
    const normalized = normalizeSegment(params.segment);
    const hasMatch = depot.segments_cibles.some(s => 
      normalized.some(n => s.toUpperCase() === n || s.toUpperCase().includes(n))
    );
    if (!hasMatch) {
      reasons.push(`Ce produit n'est pas disponible pour le segment "${params.segment}". Segments cibles: ${depot.segments_cibles.join(', ')}`);
    }
  }
  
  if (reasons.length === 0) {
    return {
      eligible: true,
      reasons: ['✓ Éligible à ce produit'],
      depot,
      canaux_vente: depot.canaux_vente ?? [],
    };
  }
  
  return { 
    eligible: false, 
    reasons, 
    depot, 
    canaux_vente: depot.canaux_vente ?? [] 
  };
}

/**
 * Compare multiple depot products
 */
export function compareDepotsVente(idProduits: string[]): {
  depots: DepotVente[];
  comparison: Array<{
    id_produit: string;
    nom_produit: string;
    categorie: string;
    type_produit: string;
    marque: string | null;
    modele: string | null;
    prix_principal: number | null;
    prix_ancien: number | null;
    economie_da: number | null;
    reduction_percentage: number | null;
    segments_cibles: string[];
    garantie_mois: number | null;
    canaux_vente: string[];
  }>;
} {
  const depots = idProduits
    .map(id => getDepotById(id))
    .filter((d): d is DepotVente => d !== null);
  
  const comparison = depots.map(depot => {
    const pricing = getProductPrice(depot);
    
    return {
      id_produit: depot.id_produit,
      nom_produit: depot.nom_produit,
      categorie: depot.categorie,
      type_produit: depot.type_produit,
      marque: depot.marque ?? null,
      modele: depot.modele ?? null,
      prix_principal: pricing.prix_principal,
      prix_ancien: pricing.prix_ancien,
      economie_da: pricing.economie_da,
      reduction_percentage: pricing.reduction_percentage,
      segments_cibles: depot.segments_cibles ?? [],
      garantie_mois: depot.garantie_mois ?? null,
      canaux_vente: depot.canaux_vente ?? [],
    };
  });
  
  return { depots, comparison };
}

/**
 * Get SAV and warranty info for a depot product
 */
export function getDepotSAV(idProduit: string): {
  depot: DepotVente | null;
  garantie_mois: number | null;
  sav_partenaire: string | null;
  contact_sav: unknown;
  couverture_garantie: string[];
  sav_procedure: unknown;
  accessoires_inclus: string[];
} {
  const depot = getDepotById(idProduit);
  return {
    depot,
    garantie_mois: depot?.garantie_mois ?? null,
    sav_partenaire: depot?.sav_partenaire ?? null,
    contact_sav: depot?.contact_sav ?? null,
    couverture_garantie: depot?.couverture_garantie ?? [],
    sav_procedure: depot?.sav_procedure ?? null,
    accessoires_inclus: depot?.accessoires_inclus ?? [],
  };
}

/**
 * Get notes and additional info for a depot product
 */
export function getDepotNotes(idProduit: string): {
  depot: DepotVente | null;
  notes: string[];
  avantages: string[];
  points_forts: string[];
  canaux_vente: string[];
} {
  const depot = getDepotById(idProduit);
  return {
    depot,
    notes: depot?.notes ?? [],
    avantages: [
      ...(depot?.avantages ?? []),
      ...(depot?.avantages_cles ?? []),
      ...(depot?.avantages_principaux ?? []),
    ],
    points_forts: depot?.points_forts ?? [],
    canaux_vente: depot?.canaux_vente ?? [],
  };
}

/**
 * List all available categories
 */
export function listCategories(): string[] {
  loadDepots();
  return Array.from(indexByCategorie?.keys() || []);
}

/**
 * List all available marques
 */
export function listMarques(): string[] {
  loadDepots();
  return Array.from(indexByMarque?.keys() || []);
}

/**
 * List all available partenaires
 */
export function listPartenaires(): string[] {
  loadDepots();
  return Array.from(indexByPartenaire?.keys() || []);
}

// ============================================================================
// FAST INDEX-BASED SEARCH FUNCTIONS - 100-1000x PLUS RAPIDE
// ============================================================================

/**
 * Search depots by keyword (FAST: O(1) lookup)
 * Ex: searchDepotsByKeyword('e-learning') -> instantané
 */
export function searchDepotsByKeyword(keyword: string): DepotVente[] {
  loadDepots();
  
  if (!invertedIndexesDepots) return [];
  
  const keywordLower = keyword.toLowerCase();
  const produitIds = invertedIndexesDepots.keywords.get(keywordLower);
  
  if (!produitIds) return [];
  
  return Array.from(produitIds)
    .map(id => indexById?.get(id))
    .filter((d): d is DepotVente => d !== undefined);
}

/**
 * Search depots by specifications (FAST: O(1) bucket lookups)
 */
export function searchDepotsBySpec(spec: {
  minRam?: number;
  minStockage?: number;
  minBatterie?: number;
  couleur?: string;
  garantieMois?: number;
}): DepotVente[] {
  loadDepots();
  
  if (!invertedIndexesDepots) return [];
  
  let resultIds: Set<string> | null = null;
  
  // RAM filter
  if (spec.minRam) {
    const ramIds = new Set<string>();
    const relevantBuckets = ['8-10', '12+'].filter(b => {
      const minVal = parseInt(b.split('-')[0]);
      return minVal >= spec.minRam!;
    });
    
    for (const bucket of relevantBuckets) {
      const ids = invertedIndexesDepots.ramBuckets.get(bucket);
      if (ids) ids.forEach(id => ramIds.add(id));
    }
    
    resultIds = ramIds.size > 0 ? ramIds : resultIds;
  }
  
  // Stockage filter
  if (spec.minStockage) {
    const stockIds = new Set<string>();
    const allBuckets = ['64', '128', '256', '512+'];
    const relevantBuckets = allBuckets.filter(b => {
      const val = b === '512+' ? 512 : parseInt(b);
      return val >= spec.minStockage!;
    });
    
    for (const bucket of relevantBuckets) {
      const ids = invertedIndexesDepots.stockageBuckets.get(bucket);
      if (ids) ids.forEach(id => stockIds.add(id));
    }
    
    resultIds = resultIds
      ? new Set([...resultIds].filter(id => stockIds.has(id)))
      : stockIds;
  }
  
  // Batterie filter
  if (spec.minBatterie) {
    const battIds = new Set<string>();
    const allBuckets = ['4000-5000', '5001-6000', '6000+'];
    const relevantBuckets = allBuckets.filter(b => {
      const minVal = parseInt(b.split('-')[0]);
      return minVal >= spec.minBatterie!;
    });
    
    for (const bucket of relevantBuckets) {
      const ids = invertedIndexesDepots.batterieBuckets.get(bucket);
      if (ids) ids.forEach(id => battIds.add(id));
    }
    
    resultIds = resultIds
      ? new Set([...resultIds].filter(id => battIds.has(id)))
      : battIds;
  }
  
  // Couleur filter
  if (spec.couleur) {
    const couleurIds = invertedIndexesDepots.couleurs.get(spec.couleur.toLowerCase());
    if (!couleurIds) return [];
    
    resultIds = resultIds
      ? new Set([...resultIds].filter(id => couleurIds.has(id)))
      : new Set(couleurIds);
  }
  
  // Garantie filter
  if (spec.garantieMois) {
    const garantieIds = invertedIndexesDepots.garantieBuckets.get(spec.garantieMois.toString());
    if (!garantieIds) return [];
    
    resultIds = resultIds
      ? new Set([...resultIds].filter(id => garantieIds.has(id)))
      : new Set(garantieIds);
  }
  
  if (!resultIds) return [];
  
  return Array.from(resultIds)
    .map(id => indexById?.get(id))
    .filter((d): d is DepotVente => d !== undefined);
}

/**
 * Combined fast search for depots - intersects multiple indexes
 */
export interface FastSearchDepotsParams {
  keyword?: string;
  categorie?: string;
  marque?: string;
  segment?: string;
  partenaire?: string;
  minRam?: number;
  minStockage?: number;
  minBatterie?: number;
  couleur?: string;
  garantieMois?: number;
  hasReduction?: boolean;
  maxPrice?: number;
}

export function fastSearchDepots(params: FastSearchDepotsParams): DepotVente[] {
  loadDepots();
  
  if (!invertedIndexesDepots) return [];
  
  let candidateIds: Set<string> | null = null;
  
  // 1. Keyword filter
  if (params.keyword) {
    const keywordIds = invertedIndexesDepots.keywords.get(params.keyword.toLowerCase());
    if (!keywordIds) return [];
    candidateIds = new Set(keywordIds);
  }
  
  // 2. Categorie filter (use existing index)
  if (params.categorie) {
    const catDepots = getDepotsByCategorie(params.categorie);
    const catIds = new Set(catDepots.map(d => d.id_produit));
    
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => catIds.has(id)))
      : catIds;
  }
  
  // 3. Marque filter
  if (params.marque) {
    const marqueDepots = getDepotsByMarque(params.marque);
    const marqueIds = new Set(marqueDepots.map(d => d.id_produit));
    
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => marqueIds.has(id)))
      : marqueIds;
  }
  
  // 4. Segment filter
  if (params.segment) {
    const segmentDepots = getDepotsBySegment(params.segment);
    const segmentIds = new Set(segmentDepots.map(d => d.id_produit));
    
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => segmentIds.has(id)))
      : segmentIds;
  }
  
  // 5. Partenaire filter
  if (params.partenaire) {
    const partDepots = getDepotsByPartenaire(params.partenaire);
    const partIds = new Set(partDepots.map(d => d.id_produit));
    
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => partIds.has(id)))
      : partIds;
  }
  
  // 6. Specs filters
  const specResults = searchDepotsBySpec({
    minRam: params.minRam,
    minStockage: params.minStockage,
    minBatterie: params.minBatterie,
    couleur: params.couleur,
    garantieMois: params.garantieMois,
  });
  
  if (specResults.length > 0) {
    const specIds = new Set(specResults.map(d => d.id_produit));
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => specIds.has(id)))
      : specIds;
  }
  
  // 7. Reduction filter
  if (params.hasReduction === true) {
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter(id => invertedIndexesDepots!.hasReduction.has(id)))
      : new Set(invertedIndexesDepots.hasReduction);
  }
  
  // 8. Get depots from IDs
  let results = candidateIds
    ? Array.from(candidateIds)
        .map(id => indexById?.get(id))
        .filter((d): d is DepotVente => d !== undefined)
    : loadDepots();
  
  // 9. Post-filter by max price
  if (params.maxPrice !== undefined) {
    results = results.filter(depot => {
      const prix = depot.prix_ttc_da || depot.prix_nouveau_ttc_da;
      return prix !== undefined && prix <= params.maxPrice!;
    });
  }
  
  return results;
}

/**
 * Get statistics about indexed depots
 */
export function getDepotsIndexStatistics(): {
  totalDepots: number;
  keywordsCount: number;
  ramBucketsCount: number;
  stockageBucketsCount: number;
  couleursCount: number;
  hasReductionCount: number;
} {
  loadDepots();
  
  if (!invertedIndexesDepots) {
    return {
      totalDepots: 0,
      keywordsCount: 0,
      ramBucketsCount: 0,
      stockageBucketsCount: 0,
      couleursCount: 0,
      hasReductionCount: 0,
    };
  }
  
  return {
    totalDepots: depotsCache?.length || 0,
    keywordsCount: invertedIndexesDepots.keywords.size,
    ramBucketsCount: invertedIndexesDepots.ramBuckets.size,
    stockageBucketsCount: invertedIndexesDepots.stockageBuckets.size,
    couleursCount: invertedIndexesDepots.couleurs.size,
    hasReductionCount: invertedIndexesDepots.hasReduction.size,
  };
}
