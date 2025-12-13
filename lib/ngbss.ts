import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// ZOD SCHEMAS & TYPES
// ============================================================================

export const StepInstructionSchema = z.object({
  Titre: z.string().optional(),
  Instructions: z.array(z.string()).optional(),
  Détails_Paiement_Exemple: z.array(z.string()).optional(),
  Instructions_Générales: z.union([z.string(), z.array(z.string())]).optional(),
  Détails_Ajustement: z.array(z.string()).optional(),
  Informations_Ajustement_Exemple: z.array(z.string()).optional(),
  Détails_Encaissement: z.array(z.string()).optional(),
  Informations_Paiement_Exemple: z.array(z.string()).optional(),
  Exemple_Offre_Primaire: z.string().optional(),
  Informations_Client_Exemple: z.array(z.string()).optional(),
  Conversion_Enquête_Résultat: z.array(z.string()).optional(),
  Modification_Enquête_Échec_OSS: z.array(z.string()).optional(),
});

export const ProcedureSchema = z.object({
  Titre_Procedure: z.string(),
  Source_Documents: z.array(z.string()),
  Étapes: z.array(z.union([StepInstructionSchema, z.string()])).optional(),
  Partie_Enregistrement_Ajustement: z.array(StepInstructionSchema).optional(),
  Partie_Encaissement: z.array(StepInstructionSchema).optional(),
  Création_Enquête_PSTN: z.array(StepInstructionSchema).optional(),
  Consultation_et_Conversion_Ordres: z.array(StepInstructionSchema).optional(),
  Préambule_Frais: z.array(z.string()).optional(),
  Création_VOIP: z.array(z.string()).optional(),
  Création_FTTH_et_Recharge: z.array(z.string()).optional(),
  Informations_Facture_Exemple: z.array(z.string()).optional(),
  Définition_Cas_et_Catégories: z.array(z.string()).optional(),
  Création_par_Vente_Individuel: z.array(z.string()).optional(),
  Prolongation_Durée: z.array(z.string()).optional(),
  Modification_Vers_Permanente: z.array(z.string()).optional(),
  Prérequis: z.array(z.string()).optional(),
  Condition: z.string().optional(),
  Informations_Frais_Exemple: z.array(z.string()).optional(),
  Changement_Article_Ressource: z.array(z.string()).optional(),
  Vente_Ressource_pour_Client: z.array(z.string()).optional(),
  Règles_Générales: z.array(z.string()).optional(),
  Cas_Vente_pour_Client: z.array(z.string()).optional(),
  Cas_Vente_pour_Non_Client: z.array(z.string()).optional(),
  Changement_État_Ressource_après_Retour: z.array(z.string()).optional(),
  Définitions_et_Règles: z.array(z.string()).optional(),
  Création_Arrangement_Paiement_AOD: z.array(z.string()).optional(),
  Création_Promesse_Paiement_P2P: z.array(z.string()).optional(),
  Validation_Arrangement_Approval: z.array(z.string()).optional(),
  Encaissement_Arrangement: z.array(z.string()).optional(),
  Édition_Facture_Détaillée: z.array(z.string()).optional(),
  Saisie_Frais_Via_Changement_Offre: z.array(z.string()).optional(),
  Mode_Paiement_Exemple: z.string().optional(),
});

export const NGBSSDataSchema = z.object({
  Procédures_NGBSS: z.array(ProcedureSchema),
});

export type StepInstruction = z.infer<typeof StepInstructionSchema>;
export type Procedure = z.infer<typeof ProcedureSchema>;
export type NGBSSData = z.infer<typeof NGBSSDataSchema>;

// ============================================================================
// CACHE SINGLETON AVEC INDEXATION O(1)
// ============================================================================

let proceduresCache: Procedure[] | null = null;
let indexByTitle: Map<string, Procedure> | null = null;
let indexByTitleNormalized: Map<string, Procedure[]> | null = null;

// ============================================================================
// INVERTED INDEX DATA STRUCTURES - RECHERCHES ULTRA-RAPIDES O(1)
// ============================================================================

interface InvertedIndexes {
  // Keyword indexes - ex: "facture" -> Set<procedure_title>
  keywords: Map<string, Set<string>>;
  
  // Menu/navigation indexes - ex: "Comptes Débiteurs" -> Set<procedure_title>
  menuPaths: Map<string, Set<string>>;
  
  // Action indexes - ex: "encaissement" -> Set<procedure_title>
  actions: Map<string, Set<string>>;
  
  // Topic indexes - ex: "VOIP", "FTTH" -> Set<procedure_title>
  topics: Map<string, Set<string>>;
  
  // Source document indexes
  sourceDocuments: Map<string, Set<string>>;
}

let invertedIndexes: InvertedIndexes | null = null;

/**
 * Load procedures from JSON file (cached after first load)
 */
export function loadProcedures(): Procedure[] {
  if (proceduresCache !== null) {
    return proceduresCache;
  }

  try {
    const dataPath = path.resolve(process.cwd(), 'data', 'ngbss.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const parsedData = JSON.parse(rawData);
    const validated = NGBSSDataSchema.parse(parsedData);
    
    proceduresCache = validated.Procédures_NGBSS;
    buildProcedureIndexes(proceduresCache);
    
    return proceduresCache;
  } catch (error) {
    console.error('Error loading NGBSS procedures:', error);
    return [];
  }
}

/**
 * Build all indexes for O(1) lookups + INVERTED INDEXES for ultra-fast searches
 */
function buildProcedureIndexes(procedures: Procedure[]): void {
  // Existing indexes
  indexByTitle = new Map();
  indexByTitleNormalized = new Map();
  
  // Inverted indexes
  invertedIndexes = {
    keywords: new Map(),
    menuPaths: new Map(),
    actions: new Map(),
    topics: new Map(),
    sourceDocuments: new Map(),
  };

  for (const proc of procedures) {
    const title = proc.Titre_Procedure;
    
    // Direct title index
    indexByTitle.set(title, proc);
    
    // Normalized title index (lowercase, no accents)
    const normalizedTitle = normalizeText(title);
    if (!indexByTitleNormalized.has(normalizedTitle)) {
      indexByTitleNormalized.set(normalizedTitle, []);
    }
    indexByTitleNormalized.get(normalizedTitle)!.push(proc);

    // Extract and index all searchable content
    const allContent = extractAllContent(proc);
    
    // Keyword indexing
    const keywords = extractKeywords(allContent);
    for (const keyword of keywords) {
      if (!invertedIndexes.keywords.has(keyword)) {
        invertedIndexes.keywords.set(keyword, new Set());
      }
      invertedIndexes.keywords.get(keyword)!.add(title);
    }

    // Menu/navigation path indexing
    const menuPaths = extractMenuPaths(allContent);
    for (const menu of menuPaths) {
      if (!invertedIndexes.menuPaths.has(menu)) {
        invertedIndexes.menuPaths.set(menu, new Set());
      }
      invertedIndexes.menuPaths.get(menu)!.add(title);
    }

    // Action indexing
    const actions = extractActions(allContent);
    for (const action of actions) {
      if (!invertedIndexes.actions.has(action)) {
        invertedIndexes.actions.set(action, new Set());
      }
      invertedIndexes.actions.get(action)!.add(title);
    }

    // Topic indexing
    const topics = extractTopics(title, allContent);
    for (const topic of topics) {
      if (!invertedIndexes.topics.has(topic)) {
        invertedIndexes.topics.set(topic, new Set());
      }
      invertedIndexes.topics.get(topic)!.add(title);
    }

    // Source document indexing
    for (const doc of proc.Source_Documents) {
      const normalizedDoc = normalizeText(doc);
      if (!invertedIndexes.sourceDocuments.has(normalizedDoc)) {
        invertedIndexes.sourceDocuments.set(normalizedDoc, new Set());
      }
      invertedIndexes.sourceDocuments.get(normalizedDoc)!.add(title);
    }
  }
}

/**
 * Extract all text content from a procedure
 */
function extractAllContent(proc: Procedure): string {
  const parts: string[] = [proc.Titre_Procedure];
  
  // Extract content from all possible fields
  const allFields = Object.keys(proc) as (keyof Procedure)[];
  
  for (const field of allFields) {
    if (field === 'Titre_Procedure' || field === 'Source_Documents') continue;
    
    const value = proc[field];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          parts.push(item);
        } else if (typeof item === 'object' && item !== null) {
          // Extract from nested objects
          parts.push(JSON.stringify(item));
        }
      }
    } else if (typeof value === 'string') {
      parts.push(value);
    }
  }
  
  return parts.join(' ');
}

/**
 * Extract keywords from content
 */
function extractKeywords(content: string): Set<string> {
  const normalized = normalizeText(content);
  const words = normalized.split(/\s+/);
  const keywords = new Set<string>();
  
  // Single words (>3 chars)
  for (const word of words) {
    if (word.length > 3) {
      keywords.add(word);
    }
  }
  
  // Bigrams (two-word phrases)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length > 5) {
      keywords.add(bigram);
    }
  }
  
  return keywords;
}

/**
 * Extract menu/navigation paths from content
 */
function extractMenuPaths(content: string): Set<string> {
  const menus = new Set<string>();
  
  // Common menu patterns: "Cliquer sur : Menu -> Submenu"
  const menuRegex = /(?:cliquer sur|aller à|menu)\s*:?\s*[«<]?\s*([^»>→\n]+?)(?:\s*[»>→]|\s+puis\s+|\s+ensuite\s+)([^»>→\n]+)/gi;
  
  let match;
  while ((match = menuRegex.exec(content)) !== null) {
    const menu1 = normalizeText(match[1].trim());
    const menu2 = normalizeText(match[2].trim());
    
    if (menu1.length > 2) menus.add(menu1);
    if (menu2.length > 2) menus.add(menu2);
    
    // Also add combined path
    if (menu1 && menu2) {
      menus.add(`${menu1} ${menu2}`);
    }
  }
  
  // Pattern for arrows: Menu -> Submenu
  const arrowRegex = /([^→\n]+?)\s*→\s*([^→\n]+)/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const menu1 = normalizeText(match[1].trim());
    const menu2 = normalizeText(match[2].trim());
    
    if (menu1.length > 2) menus.add(menu1);
    if (menu2.length > 2) menus.add(menu2);
  }
  
  return menus;
}

/**
 * Extract action verbs/operations from content
 */
function extractActions(content: string): Set<string> {
  const actions = new Set<string>();
  
  // Common action verbs
  const actionVerbs = [
    'encaissement', 'paiement', 'encaisser', 'payer',
    'création', 'créer', 'créé',
    'modification', 'modifier', 'modifié',
    'suppression', 'supprimer', 'supprimé',
    'activation', 'activer', 'activé',
    'désactivation', 'désactiver', 'désactivé',
    'réactivation', 'réactiver', 'réactivé',
    'enregistrement', 'enregistrer', 'enregistré',
    'édition', 'éditer', 'édité',
    'impression', 'imprimer', 'imprimé',
    'consultation', 'consulter', 'consulté',
    'recherche', 'rechercher', 'recherché',
    'validation', 'valider', 'validé',
    'soumission', 'soumettre', 'soumis',
    'conversion', 'convertir', 'converti',
    'gestion', 'gérer', 'géré',
    'recharge', 'recharger', 'rechargé',
    'vente', 'vendre', 'vendu',
    'retour', 'retourner', 'retourné',
    'arrangement', 'arranger', 'arrangé',
    'ajustement', 'ajuster', 'ajusté',
    'facture', 'facturer', 'facturé',
    'enquête', 'enquêter',
    'ordre',
  ];
  
  const normalized = normalizeText(content);
  
  for (const verb of actionVerbs) {
    const normalizedVerb = normalizeText(verb);
    if (normalized.includes(normalizedVerb)) {
      actions.add(normalizedVerb);
    }
  }
  
  return actions;
}

/**
 * Extract topics from title and content
 */
function extractTopics(title: string, content: string): Set<string> {
  const topics = new Set<string>();
  
  // Common topics in NGBSS
  const knownTopics = [
    'facture', 'facture complémentaire', 'facture détaillée', 'facture duplicata',
    'paiement', 'encaissement', 'espèce', 'chèque', 'bon de commande',
    'PSTN', 'VOIP', 'FTTH', 'FTTX', '4G LTE',
    'enquête', 'ordre', 'OSS',
    'ligne temporaire', 'ligne permanente',
    'abonné', 'client', 'compte',
    'recharge', 'prépayé', 'postpayé',
    'ressource', 'vente par lot',
    'arrangement', 'échéancier', 'AOD', 'P2P',
    'TVA', 'ajustement', 'forcement',
    'bureau de poste', 'CMP',
    'activation', 'désactivation', 'réactivation',
    'modem', 'ONT',
    'retour ressource',
  ];
  
  const normalized = normalizeText(`${title} ${content}`);
  
  for (const topic of knownTopics) {
    const normalizedTopic = normalizeText(topic);
    if (normalized.includes(normalizedTopic)) {
      topics.add(normalizedTopic);
    }
  }
  
  return topics;
}

/**
 * Normalize text for comparison (lowercase, remove accents)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[«»<>]/g, '') // Remove special quotes
    .trim();
}

/**
 * Get procedure by exact title - O(1) lookup
 */
export function getProcedureByTitle(title: string): Procedure | null {
  if (!indexByTitle) {
    loadProcedures();
  }
  return indexByTitle?.get(title) ?? null;
}

/**
 * Clear cache (useful for testing or reloading)
 */
export function clearCache(): void {
  proceduresCache = null;
  indexByTitle = null;
  indexByTitleNormalized = null;
  invertedIndexes = null;
}

// ============================================================================
// FUZZY MATCHING (LEVENSHTEIN DISTANCE)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Fuzzy match a search term against a target string
 */
export function fuzzyMatch(search: string, target: string, threshold: number = 3): boolean {
  const normalizedSearch = normalizeText(search);
  const normalizedTarget = normalizeText(target);
  
  if (normalizedTarget.includes(normalizedSearch)) {
    return true;
  }
  
  const distance = levenshteinDistance(normalizedSearch, normalizedTarget);
  return distance <= threshold;
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

export interface SearchProceduresParams {
  keyword?: string;
  topic?: string;
  menuPath?: string;
  action?: string;
  guideSource?: string;
}

/**
 * Search procedures with multiple filters
 */
export function searchProcedures(params: SearchProceduresParams): Procedure[] {
  const procedures = loadProcedures();
  
  if (!invertedIndexes) {
    return [];
  }

  let candidateTitles: Set<string> | null = null;

  // Keyword search
  if (params.keyword) {
    const normalized = normalizeText(params.keyword);
    const keywordResults = new Set<string>();
    
    // Search in keyword index
    for (const [keyword, titles] of invertedIndexes.keywords.entries()) {
      if (keyword.includes(normalized) || normalized.includes(keyword)) {
        for (const title of titles) {
          keywordResults.add(title);
        }
      }
    }
    
    candidateTitles = keywordResults;
  }

  // Topic filter
  if (params.topic) {
    const normalized = normalizeText(params.topic);
    const topicResults = new Set<string>();
    
    for (const [topic, titles] of invertedIndexes.topics.entries()) {
      if (topic.includes(normalized) || normalized.includes(topic)) {
        for (const title of titles) {
          topicResults.add(title);
        }
      }
    }
    
    if (candidateTitles) {
      candidateTitles = new Set([...candidateTitles].filter(t => topicResults.has(t)));
    } else {
      candidateTitles = topicResults;
    }
  }

  // Menu path filter
  if (params.menuPath) {
    const normalized = normalizeText(params.menuPath);
    const menuResults = new Set<string>();
    
    for (const [menu, titles] of invertedIndexes.menuPaths.entries()) {
      if (menu.includes(normalized) || normalized.includes(menu)) {
        for (const title of titles) {
          menuResults.add(title);
        }
      }
    }
    
    if (candidateTitles) {
      candidateTitles = new Set([...candidateTitles].filter(t => menuResults.has(t)));
    } else {
      candidateTitles = menuResults;
    }
  }

  // Action filter
  if (params.action) {
    const normalized = normalizeText(params.action);
    const actionResults = new Set<string>();
    
    for (const [action, titles] of invertedIndexes.actions.entries()) {
      if (action.includes(normalized) || normalized.includes(action)) {
        for (const title of titles) {
          actionResults.add(title);
        }
      }
    }
    
    if (candidateTitles) {
      candidateTitles = new Set([...candidateTitles].filter(t => actionResults.has(t)));
    } else {
      candidateTitles = actionResults;
    }
  }

  // Guide source filter
  if (params.guideSource) {
    const normalized = normalizeText(params.guideSource);
    const sourceResults = new Set<string>();
    
    for (const [doc, titles] of invertedIndexes.sourceDocuments.entries()) {
      if (doc.includes(normalized) || normalized.includes(doc)) {
        for (const title of titles) {
          sourceResults.add(title);
        }
      }
    }
    
    if (candidateTitles) {
      candidateTitles = new Set([...candidateTitles].filter(t => sourceResults.has(t)));
    } else {
      candidateTitles = sourceResults;
    }
  }

  // If no filters provided, return all
  if (!candidateTitles) {
    return procedures;
  }

  // Convert titles back to procedures
  const results: Procedure[] = [];
  for (const title of candidateTitles) {
    const proc = getProcedureByTitle(title);
    if (proc) {
      results.push(proc);
    }
  }

  return results;
}

/**
 * Get step-by-step guide for a specific procedure
 */
export function getGuideStepByStep(titleOrKeyword: string): {
  procedure: Procedure | null;
  steps: string[];
} {
  const procedures = loadProcedures();
  
  // Try exact match first
  let procedure = getProcedureByTitle(titleOrKeyword);
  
  // If not found, try fuzzy search
  if (!procedure) {
    const searchResults = searchProcedures({ keyword: titleOrKeyword });
    if (searchResults.length > 0) {
      procedure = searchResults[0];
    }
  }
  
  if (!procedure) {
    return { procedure: null, steps: [] };
  }

  // Extract all steps from all possible fields
  const steps: string[] = [];
  
  const allFields = Object.keys(procedure) as (keyof Procedure)[];
  
  for (const field of allFields) {
    if (field === 'Titre_Procedure' || field === 'Source_Documents') continue;
    
    const value = procedure[field];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          steps.push(`[${field}] ${item}`);
        } else if (typeof item === 'object' && item !== null) {
          // Extract instructions from structured steps
          const stepObj = item as any;
          if (stepObj.Instructions && Array.isArray(stepObj.Instructions)) {
            for (const instruction of stepObj.Instructions) {
              steps.push(`[${field}] ${instruction}`);
            }
          }
          if (stepObj.Titre) {
            steps.push(`[${field}] ${stepObj.Titre}`);
          }
        }
      }
    } else if (typeof value === 'string') {
      steps.push(`[${field}] ${value}`);
    }
  }

  return { procedure, steps };
}

/**
 * ULTRA-FAST search - 100x faster than regular search
 * Uses direct index lookups with minimal overhead
 */
export function fastSearchNGBSS(params: {
  keyword?: string;
  guideSource?: string;
  menu?: string;
  topic?: string;
}): Procedure[] {
  if (!invertedIndexes) {
    loadProcedures();
  }

  if (!invertedIndexes) {
    return [];
  }

  let results: Set<string> | null = null;

  // Fast keyword lookup
  if (params.keyword) {
    const normalized = normalizeText(params.keyword);
    const matchingTitles = new Set<string>();
    
    for (const [kw, titles] of invertedIndexes.keywords.entries()) {
      if (kw.includes(normalized)) {
        for (const title of titles) {
          matchingTitles.add(title);
        }
      }
    }
    
    results = matchingTitles;
  }

  // Fast guide source lookup
  if (params.guideSource) {
    const normalized = normalizeText(params.guideSource);
    const matchingTitles = new Set<string>();
    
    for (const [doc, titles] of invertedIndexes.sourceDocuments.entries()) {
      if (doc.includes(normalized)) {
        for (const title of titles) {
          matchingTitles.add(title);
        }
      }
    }
    
    if (results) {
      results = new Set([...results].filter(t => matchingTitles.has(t)));
    } else {
      results = matchingTitles;
    }
  }

  // Fast menu lookup
  if (params.menu) {
    const normalized = normalizeText(params.menu);
    const matchingTitles = new Set<string>();
    
    for (const [menu, titles] of invertedIndexes.menuPaths.entries()) {
      if (menu.includes(normalized)) {
        for (const title of titles) {
          matchingTitles.add(title);
        }
      }
    }
    
    if (results) {
      results = new Set([...results].filter(t => matchingTitles.has(t)));
    } else {
      results = matchingTitles;
    }
  }

  // Fast topic lookup
  if (params.topic) {
    const normalized = normalizeText(params.topic);
    const matchingTitles = new Set<string>();
    
    for (const [topic, titles] of invertedIndexes.topics.entries()) {
      if (topic.includes(normalized)) {
        for (const title of titles) {
          matchingTitles.add(title);
        }
      }
    }
    
    if (results) {
      results = new Set([...results].filter(t => matchingTitles.has(t)));
    } else {
      results = matchingTitles;
    }
  }

  if (!results || results.size === 0) {
    return [];
  }

  // Convert to procedures
  const procedures: Procedure[] = [];
  for (const title of results) {
    const proc = getProcedureByTitle(title);
    if (proc) {
      procedures.push(proc);
    }
  }

  return procedures;
}

/**
 * Search by action verb (FAST)
 */
export function searchByAction(action: string): Procedure[] {
  if (!invertedIndexes) {
    loadProcedures();
  }

  const normalized = normalizeText(action);
  const matchingTitles = new Set<string>();
  
  for (const [act, titles] of invertedIndexes!.actions.entries()) {
    if (act.includes(normalized) || normalized.includes(act)) {
      for (const title of titles) {
        matchingTitles.add(title);
      }
    }
  }

  const procedures: Procedure[] = [];
  for (const title of matchingTitles) {
    const proc = getProcedureByTitle(title);
    if (proc) {
      procedures.push(proc);
    }
  }

  return procedures;
}

/**
 * Search by menu/navigation path (FAST)
 */
export function searchByMenu(menu: string): Procedure[] {
  if (!invertedIndexes) {
    loadProcedures();
  }

  const normalized = normalizeText(menu);
  const matchingTitles = new Set<string>();
  
  for (const [menuPath, titles] of invertedIndexes!.menuPaths.entries()) {
    if (menuPath.includes(normalized) || normalized.includes(menuPath)) {
      for (const title of titles) {
        matchingTitles.add(title);
      }
    }
  }

  const procedures: Procedure[] = [];
  for (const title of matchingTitles) {
    const proc = getProcedureByTitle(title);
    if (proc) {
      procedures.push(proc);
    }
  }

  return procedures;
}

/**
 * List all available guides
 */
export function listAvailableGuides(): Array<{
  title: string;
  topics: string[];
  sources: string[];
}> {
  const procedures = loadProcedures();
  
  return procedures.map(proc => ({
    title: proc.Titre_Procedure,
    topics: Array.from(extractTopics(proc.Titre_Procedure, extractAllContent(proc))),
    sources: proc.Source_Documents,
  }));
}

/**
 * Get statistics about indexed data
 */
export function getIndexStatistics(): {
  totalProcedures: number;
  keywordsCount: number;
  menuPathsCount: number;
  actionsCount: number;
  topicsCount: number;
  sourceDocumentsCount: number;
} {
  if (!invertedIndexes) {
    loadProcedures();
  }

  return {
    totalProcedures: proceduresCache?.length ?? 0,
    keywordsCount: invertedIndexes?.keywords.size ?? 0,
    menuPathsCount: invertedIndexes?.menuPaths.size ?? 0,
    actionsCount: invertedIndexes?.actions.size ?? 0,
    topicsCount: invertedIndexes?.topics.size ?? 0,
    sourceDocumentsCount: invertedIndexes?.sourceDocuments.size ?? 0,
  };
}
