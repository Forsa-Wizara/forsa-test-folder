import { tool } from 'ai';
import { z } from 'zod';
import {
  searchConventions as searchConventionsLib,
  checkEligibility as checkEligibilityLib,
  searchOffers as searchOffersLib,
  getRequiredDocuments as getRequiredDocumentsLib,
  compareOffers as compareOffersLib,
  getConventionDetails as getConventionDetailsLib,
  relaxedSearchOffers,
} from '@/lib/conventions';

// =====================================================================
// TOOL 1: Search Conventions
// =====================================================================
export const searchConventions = tool({
  description: 'Recherche des conventions par nom de partenaire, alias, ou type de client (B2C/B2B). Utilise le fuzzy matching pour trouver des correspondances même avec des fautes de frappe. Retourne une liste de conventions avec leurs IDs, noms, et éligibilités.',
  inputSchema: z.object({
    partnerName: z.string().optional().describe('Nom du partenaire ou alias (ex: "L", "Etablissement S", "A"). Le fuzzy matching est automatique.'),
    clientType: z.enum(['B2C', 'B2B']).optional().describe('Type de client : B2C (particuliers) ou B2B (entreprises)'),
  }),
  execute: async ({ partnerName, clientType }) => {
    try {
      const results = searchConventionsLib({
        partnerName,
        clientType,
        useFuzzy: true,
      });
      
      return {
        success: true,
        count: results.length,
        conventions: results.map(c => ({
          convention_id: c.convention_id,
          partner_name: c.partner_name,
          aliases: c.aliases,
          client_type: c.client_type,
          eligibility: c.eligibility,
          offers_count: c.offers.length,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la recherche de conventions',
        conventions: [],
      };
    }
  },
});

// =====================================================================
// TOOL 2: Check Eligibility
// =====================================================================
export const checkEligibility = tool({
  description: "Vérifie si un utilisateur est éligible pour une convention spécifique selon son statut (actif/retraité/famille/filiale). Retourne un booléen eligible + liste de raisons.",
  inputSchema: z.object({
    conventionId: z.string().describe("ID de la convention (ex: 'conv_l', 'conv_s')"),
    isActive: z.boolean().optional().describe('Est-ce un employé actif ?'),
    isRetired: z.boolean().optional().describe('Est-ce un retraité ?'),
    isFamilyMember: z.boolean().optional().describe('Est-ce un membre de la famille ?'),
    isSubsidiary: z.boolean().optional().describe('Est-ce une filiale ?'),
  }),
  execute: async ({ conventionId, isActive, isRetired, isFamilyMember, isSubsidiary }) => {
    try {
      const result = checkEligibilityLib({
        conventionId,
        isActive,
        isRetired,
        isFamilyMember,
        isSubsidiary,
      });
      
      return {
        success: true,
        eligible: result.eligible,
        reasons: result.reasons,
        convention_name: result.convention?.partner_name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur lors de la vérification d'éligibilité",
      };
    }
  },
});

// =====================================================================
// TOOL 3: Search Offers
// =====================================================================
export const searchOffers = tool({
  description: 'Recherche des offres (Internet, Téléphonie, 4G, Hardware) avec filtres multiples : catégorie, technologie, vitesse min/max, prix max, condition. Retourne les offres triées par prix croissant.',
  inputSchema: z.object({
    conventionIds: z.array(z.string()).optional().describe('Liste des IDs de conventions à filtrer'),
    category: z.enum(['INTERNET', 'TELEPHONY', '4G', 'HARDWARE', 'EMAIL', 'E-LEARNING']).optional().describe('Catégorie : INTERNET, TELEPHONY, 4G, HARDWARE, EMAIL, E-LEARNING'),
    technology: z.string().optional().describe('Technologie : ADSL, VDSL, FIBRE, FTTH (normalisation automatique)'),
    minSpeed: z.number().optional().describe('Vitesse minimale en Mbps (ex: 50)'),
    maxSpeed: z.number().optional().describe('Vitesse maximale en Mbps (ex: 200)'),
    maxPrice: z.number().optional().describe('Prix maximum en DA (Dinars Algériens)'),
    condition: z.string().optional().describe('Condition spécifique (ex: PERSONNEL, FAMILLE, ACTIF)'),
  }),
  execute: async ({ conventionIds, category, technology, minSpeed, maxSpeed, maxPrice, condition }) => {
    try {
      // Try normal search first
      let results = searchOffersLib({
        conventionIds,
        category,
        technology,
        minSpeed,
        maxSpeed,
        maxPrice,
        condition,
      });
      
      // If no results, try relaxed search
      let relaxedCriteria: string[] = [];
      if (results.length === 0 && (maxPrice || minSpeed || maxSpeed || technology)) {
        const relaxed = relaxedSearchOffers({
          conventionIds,
          category,
          technology,
          minSpeed,
          maxSpeed,
          maxPrice,
          condition,
        });
        results = relaxed.results;
        relaxedCriteria = relaxed.relaxedCriteria;
      }
      
      return {
        success: true,
        count: results.length,
        relaxed: relaxedCriteria.length > 0,
        relaxedCriteria,
        offers: results.map(r => ({
          convention_id: r.convention.convention_id,
          partner_name: r.convention.partner_name,
          offer: {
            category: r.offer.category,
            technology: r.offer.technology,
            speed_mbps: r.offer.speed_mbps,
            plan: r.offer.plan,
            price_convention_da: r.offer.price_convention_da,
            price_public_da: r.offer.price_public_da,
            discount: r.offer.discount,
            condition: r.offer.condition,
            label: r.offer.label,
            note: r.offer.note,
          },
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la recherche d\'offres',
        offers: [],
      };
    }
  },
});

// =====================================================================
// TOOL 4: Get Required Documents
// =====================================================================
export const getRequiredDocuments = tool({
  description: 'Récupère la liste complète des documents requis pour souscrire à une convention spécifique. Retourne un tableau de chaînes de caractères décrivant chaque document.',
  inputSchema: z.object({
    conventionId: z.string().describe("ID de la convention (ex: 'conv_l', 'conv_s')"),
  }),
  execute: async ({ conventionId }) => {
    try {
      const result = getRequiredDocumentsLib(conventionId);
      
      if (!result.convention) {
        return {
          success: false,
          error: 'Convention introuvable',
        };
      }
      
      return {
        success: true,
        convention_id: result.convention.convention_id,
        partner_name: result.convention.partner_name,
        documents: result.documents,
        notes: result.convention.notes,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des documents',
      };
    }
  },
});

// =====================================================================
// TOOL 5: Compare Offers
// =====================================================================
export const compareOffers = tool({
  description: 'Compare plusieurs offres côte à côte avec calcul automatique des économies si prix public disponible. Utile pour aider l\'utilisateur à choisir entre plusieurs options.',
  inputSchema: z.object({
    offers: z.array(z.object({
      conventionId: z.string().describe('ID de la convention'),
      offerIndex: z.number().describe('Index de l\'offre dans le tableau offers (commence à 0)'),
    })).describe('Liste des offres à comparer'),
  }),
  execute: async ({ offers }) => {
    try {
      const results = compareOffersLib(offers);
      
      return {
        success: true,
        count: results.length,
        comparison: results.map(r => ({
          convention_id: r.convention.convention_id,
          partner_name: r.convention.partner_name,
          offer: {
            category: r.offer.category,
            technology: r.offer.technology,
            speed_mbps: r.offer.speed_mbps,
            plan: r.offer.plan,
            price_convention_da: r.offer.price_convention_da,
            price_public_da: r.offer.price_public_da,
            discount: r.offer.discount,
            label: r.offer.label,
          },
          savings: r.savings,
          savingsPercent: r.savingsPercent,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la comparaison des offres',
      };
    }
  },
});

// =====================================================================
// TOOL 6: Get Convention Details
// =====================================================================
export const getConventionDetails = tool({
  description: 'Récupère TOUS les détails d\'une convention : éligibilité complète, documents, toutes les offres, notes. Utilise cet outil pour avoir une vue exhaustive d\'une convention.',
  inputSchema: z.object({
    conventionId: z.string().describe("ID de la convention (ex: 'conv_l', 'conv_s')"),
  }),
  execute: async ({ conventionId }) => {
    try {
      const convention = getConventionDetailsLib(conventionId);
      
      if (!convention) {
        return {
          success: false,
          error: 'Convention introuvable',
        };
      }
      
      return {
        success: true,
        convention: {
          convention_id: convention.convention_id,
          partner_name: convention.partner_name,
          aliases: convention.aliases,
          client_type: convention.client_type,
          eligibility: convention.eligibility,
          documents: convention.documents,
          offers: convention.offers,
          notes: convention.notes,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des détails',
      };
    }
  },
});
