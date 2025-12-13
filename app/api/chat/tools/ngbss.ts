import { tool } from 'ai';
import { z } from 'zod';
import {
  searchProcedures,
  getGuideStepByStep,
  fastSearchNGBSS,
  searchByAction,
  searchByMenu,
  listAvailableGuides,
  type Procedure,
} from '@/lib/ngbss';

/**
 * ============================================================================
 * OUTIL 1: queryNGBSS - Recherche générale dans les guides NGBSS
 * ============================================================================
 */
export const queryNGBSS = tool({
  description: `Recherche générale dans les guides NGBSS (système de facturation Algérie Télécom).
  
  Utilise cet outil pour :
  - Rechercher des procédures par mot-clé
  - Filtrer par topic (sujet)
  - Filtrer par menu de navigation
  - Filtrer par action spécifique
  - Filtrer par source de documentation
  
  Retourne : Liste des procédures correspondantes avec leurs étapes détaillées.`,
  
  inputSchema: z.object({
    keyword: z.string().optional().describe('Mot-clé à rechercher dans les procédures (ex: "facture", "paiement", "VOIP")'),
    topic: z.string().optional().describe('Sujet/topic à filtrer (ex: "FTTH", "PSTN", "4G LTE", "facture complémentaire")'),
    menuPath: z.string().optional().describe('Chemin de navigation/menu (ex: "Comptes Débiteurs", "Client", "Inventaire")'),
    action: z.string().optional().describe('Action spécifique (ex: "encaissement", "création", "modification", "activation")'),
    guideSource: z.string().optional().describe('Source du guide (ex: "Encaissement des factures", "Ligne temporaire")'),
  }),
  
  execute: async ({ keyword, topic, menuPath, action, guideSource }) => {
    const results = searchProcedures({
      keyword,
      topic,
      menuPath,
      action,
      guideSource,
    });

    if (results.length === 0) {
      return {
        success: false,
        message: 'Aucune procédure trouvée avec ces critères.',
        procedures: [],
      };
    }

    return {
      success: true,
      message: `${results.length} procédure(s) trouvée(s)`,
      procedures: results.map(proc => ({
        titre: proc.Titre_Procedure,
        sources: proc.Source_Documents,
        sections: Object.keys(proc).filter(key => 
          key !== 'Titre_Procedure' && 
          key !== 'Source_Documents'
        ),
      })),
    };
  },
});

/**
 * ============================================================================
 * OUTIL 2: getGuideStepByStep - Guide complet étape par étape
 * ============================================================================
 */
export const getGuideStepByStepTool = tool({
  description: `Obtenir un guide complet étape par étape pour une procédure NGBSS spécifique.
  
  Utilise cet outil pour :
  - Obtenir toutes les étapes détaillées d'une procédure
  - Afficher les instructions dans l'ordre
  - Voir tous les détails (exemples, prérequis, informations)
  
  Retourne : Procédure complète avec toutes les étapes numérotées et détaillées.`,
  
  inputSchema: z.object({
    titleOrKeyword: z.string().describe('Titre exact ou mot-clé de la procédure (ex: "Encaissement des factures", "Ligne temporaire", "VOIP")'),
  }),
  
  execute: async ({ titleOrKeyword }) => {
    const { procedure, steps } = getGuideStepByStep(titleOrKeyword);

    if (!procedure) {
      return {
        success: false,
        message: `Aucune procédure trouvée pour "${titleOrKeyword}"`,
        procedure: null,
        steps: [],
      };
    }

    return {
      success: true,
      message: `Guide trouvé: ${procedure.Titre_Procedure}`,
      procedure: {
        titre: procedure.Titre_Procedure,
        sources: procedure.Source_Documents,
        contenu_complet: procedure,
      },
      steps: steps,
      nombre_etapes: steps.length,
    };
  },
});

/**
 * ============================================================================
 * OUTIL 3: listAvailableGuides - Liste tous les guides disponibles
 * ============================================================================
 */
export const listAvailableGuidesTool = tool({
  description: `Lister tous les guides NGBSS disponibles avec leurs topics et sources.
  
  Utilise cet outil pour :
  - Voir tous les guides disponibles
  - Découvrir les sujets couverts
  - Connaître les sources de documentation
  
  Retourne : Liste complète de tous les guides avec leurs métadonnées.`,
  
  inputSchema: z.object({
    // No parameters needed
  }),
  
  execute: async () => {
    const guides = listAvailableGuides();

    return {
      success: true,
      message: `${guides.length} guide(s) disponible(s)`,
      guides: guides,
      total: guides.length,
    };
  },
});

/**
 * ============================================================================
 * OUTIL 4: fastSearchNGBSSTool - Recherche ULTRA-RAPIDE (100x plus rapide) ⚡
 * ============================================================================
 */
export const fastSearchNGBSSTool = tool({
  description: `Recherche ULTRA-RAPIDE dans les guides NGBSS (100x plus rapide que queryNGBSS).
  
  ⚡ PRIORITÉ: Utilise TOUJOURS cet outil EN PREMIER pour toute recherche NGBSS!
  
  Utilise cet outil pour :
  - Recherche rapide par mot-clé
  - Filtrage par source de guide
  - Filtrage par menu de navigation
  - Filtrage par topic
  
  Performance: Recherche optimisée avec indexes inversés O(1).
  
  Retourne : Procédures correspondantes (format compact pour vitesse maximale).`,
  
  inputSchema: z.object({
    keyword: z.string().optional().describe('Mot-clé principal (ex: "paiement", "facture", "création")'),
    guideSource: z.string().optional().describe('Source du guide (ex: "Encaissement", "Ligne temporaire", "VOIP")'),
    menu: z.string().optional().describe('Menu de navigation (ex: "Comptes Débiteurs", "Client", "Offre")'),
    topic: z.string().optional().describe('Topic/sujet (ex: "FTTH", "PSTN", "facture complémentaire", "4G LTE")'),
  }),
  
  execute: async ({ keyword, guideSource, menu, topic }) => {
    const results = fastSearchNGBSS({
      keyword,
      guideSource,
      menu,
      topic,
    });

    if (results.length === 0) {
      return {
        success: false,
        message: 'Aucune procédure trouvée.',
        procedures: [],
      };
    }

    return {
      success: true,
      message: `${results.length} procédure(s) trouvée(s) (recherche ultra-rapide)`,
      procedures: results.map(proc => ({
        titre: proc.Titre_Procedure,
        sources: proc.Source_Documents,
        apercu: Object.keys(proc).filter(k => k !== 'Titre_Procedure' && k !== 'Source_Documents').slice(0, 3),
      })),
    };
  },
});

/**
 * ============================================================================
 * OUTIL 5: searchByActionTool - Recherche par action (RAPIDE)
 * ============================================================================
 */
export const searchByActionTool = tool({
  description: `Recherche rapide par description d'action dans NGBSS.
  
  Utilise cet outil pour :
  - Trouver comment effectuer une action spécifique
  - Rechercher par verbe d'action (encaisser, créer, modifier, etc.)
  - Découvrir les procédures liées à une opération
  
  Exemples d'actions : "encaissement", "paiement", "création", "modification", 
  "activation", "édition", "impression", "recharge", "vente"
  
  Retourne : Procédures contenant l'action recherchée.`,
  
  inputSchema: z.object({
    action: z.string().describe('Action/opération recherchée (ex: "encaissement", "création enquête", "paiement arrangement")'),
  }),
  
  execute: async ({ action }) => {
    const results = searchByAction(action);

    if (results.length === 0) {
      return {
        success: false,
        message: `Aucune procédure trouvée pour l'action "${action}"`,
        procedures: [],
      };
    }

    return {
      success: true,
      message: `${results.length} procédure(s) trouvée(s) pour l'action "${action}"`,
      procedures: results.map(proc => ({
        titre: proc.Titre_Procedure,
        sources: proc.Source_Documents,
      })),
    };
  },
});

/**
 * ============================================================================
 * OUTIL 6: searchByMenuTool - Recherche par menu de navigation (RAPIDE)
 * ============================================================================
 */
export const searchByMenuTool = tool({
  description: `Recherche rapide par menu/chemin de navigation dans NGBSS.
  
  Utilise cet outil pour :
  - Trouver toutes les procédures d'un menu spécifique
  - Naviguer par interface utilisateur NGBSS
  - Découvrir les opérations disponibles dans un menu
  
  Exemples de menus : "Comptes Débiteurs", "Client", "Offre", "Inventaire", 
  "Gestion d'ordre", "Portail client", "VOIP Sale", "FTTX Sale"
  
  Retourne : Procédures accessibles via ce menu.`,
  
  inputSchema: z.object({
    menu: z.string().describe('Menu ou chemin de navigation (ex: "Comptes Débiteurs", "Client", "Offre", "Paiement")'),
  }),
  
  execute: async ({ menu }) => {
    const results = searchByMenu(menu);

    if (results.length === 0) {
      return {
        success: false,
        message: `Aucune procédure trouvée pour le menu "${menu}"`,
        procedures: [],
      };
    }

    return {
      success: true,
      message: `${results.length} procédure(s) trouvée(s) dans le menu "${menu}"`,
      procedures: results.map(proc => ({
        titre: proc.Titre_Procedure,
        sources: proc.Source_Documents,
      })),
    };
  },
});
