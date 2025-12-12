import { tool } from 'ai';
import { z } from 'zod';
import {
  searchOffresReferentiel,
  getOffreDetails,
  getOffreTarifs,
  checkOffreEligibility as checkOffreEligibilityLib,
  compareOffresReferentiel,
  getOffreDocuments,
} from '@/lib/offres';

// =====================================================================
// TOOL 7: Search Offres Référentiel
// =====================================================================
export const searchOffresRef = tool({
  description: 'Recherche dans le référentiel des offres grand public (Idoom, Gamers, MOOHTARIF, 4G, etc.). Utilise ce tool pour les offres NON conventionnées. Filtres : famille (INTERNET/4G/HARDWARE), technologie, segment (RESIDENTIEL/PRO), locataire, engagement.',
  inputSchema: z.object({
    nom: z.string().optional().describe('Nom commercial de l\'offre (ex: "Gamers", "MOOHTARIF", "Boost")'),
    famille: z.string().optional().describe('Famille d\'offre : INTERNET, 4G, HARDWARE'),
    sousFamille: z.string().optional().describe('Sous-famille (ex: RESIDENTIEL_GAMING, PRO_TPE_LIBERAUX)'),
    technology: z.string().optional().describe('Technologie : FTTH, ADSL, VDSL, 4G, LTE'),
    segment: z.string().optional().describe('Segment cible : RESIDENTIEL, PRO'),
    clientType: z.string().optional().describe('Type client : B2C, B2B'),
    isLocataire: z.boolean().optional().describe('Offre pour locataires ?'),
    isConventionne: z.boolean().optional().describe('Offre conventionnée ? (généralement false pour ce référentiel)'),
    hasEngagement: z.boolean().optional().describe('Avec engagement ?'),
    maxEngagementMois: z.number().optional().describe('Engagement max en mois'),
    minDebit: z.number().optional().describe('Débit minimum en Mbps'),
    maxPrice: z.number().optional().describe('Prix maximum en DA'),
  }),
  execute: async (params) => {
    try {
      const results = searchOffresReferentiel(params);
      
      return {
        success: true,
        count: results.length,
        offres: results.map(o => ({
          id_offre: o.id_offre,
          nom_commercial: o.nom_commercial,
          famille: o.famille,
          sous_famille: o.sous_famille,
          technologies: o.technologies,
          segments_cibles: o.segments_cibles,
          client_type: o.client_type,
          engagement_mois: o.engagement_mois,
          type_offre: o.type_offre,
          avantages_principaux: o.avantages_principaux.slice(0, 3),
          limitations: o.limitations.slice(0, 2),
          prix_resume: o.tableaux_tarifaires.length > 0 
            ? `${o.tableaux_tarifaires[0].lignes.length} paliers disponibles`
            : 'Voir détails',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la recherche d\'offres',
        offres: [],
      };
    }
  },
});

// =====================================================================
// TOOL 8: Get Offre Details Référentiel
// =====================================================================
export const getOffreDetailsRef = tool({
  description: 'Récupère TOUS les détails d\'une offre du référentiel : tarifs complets, conditions, avantages, limitations, produits associés.',
  inputSchema: z.object({
    idOffre: z.string().describe("ID de l'offre (ex: 'idoom_fibre_gamers', 'moohtarif_tpe_prof')"),
  }),
  execute: async ({ idOffre }) => {
    try {
      const offre = getOffreDetails(idOffre);
      
      if (!offre) {
        return {
          success: false,
          error: 'Offre introuvable',
        };
      }
      
      // Get tarifs
      const { tableaux } = getOffreTarifs(idOffre);
      
      return {
        success: true,
        offre: {
          id_offre: offre.id_offre,
          nom_commercial: offre.nom_commercial,
          famille: offre.famille,
          sous_famille: offre.sous_famille,
          technologies: offre.technologies,
          segments_cibles: offre.segments_cibles,
          sous_segments: offre.sous_segments,
          client_type: offre.client_type,
          locataire: offre.locataire,
          type_offre: offre.type_offre,
          engagement_mois: offre.engagement_mois,
          canaux_activation: offre.canaux_activation,
          debits_eligibles: offre.debits_eligibles,
          avantages_principaux: offre.avantages_principaux,
          limitations: offre.limitations,
          conditions_particulieres: offre.conditions_particulieres,
          tableaux_tarifaires: tableaux,
          produits_associes: offre.produits_associes,
          notes: offre.notes,
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

// =====================================================================
// TOOL 9: Check Offre Eligibility Référentiel
// =====================================================================
export const checkOffreEligibilityRef = tool({
  description: 'Vérifie si un utilisateur est éligible à une offre du référentiel selon son statut (locataire, conventionne, segment).',
  inputSchema: z.object({
    idOffre: z.string().describe("ID de l'offre à vérifier"),
    isLocataire: z.boolean().optional().describe('Est-ce un locataire ?'),
    isConventionne: z.boolean().optional().describe('Est-ce un client conventionné ?'),
    segment: z.string().optional().describe('Segment : RESIDENTIEL ou PRO'),
    sousSegment: z.string().optional().describe('Sous-segment (ex: GAMERS, TPE)'),
  }),
  execute: async ({ idOffre, isLocataire, isConventionne, segment, sousSegment }) => {
    try {
      const result = checkOffreEligibilityLib({
        idOffre,
        isLocataire,
        isConventionne,
        segment,
        sousSegment,
      });
      
      return {
        success: true,
        eligible: result.eligible,
        reasons: result.reasons,
        offre_nom: result.offre?.nom_commercial,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la vérification d\'éligibilité',
      };
    }
  },
});

// =====================================================================
// TOOL 10: Compare Offres Référentiel
// =====================================================================
export const compareOffresRef = tool({
  description: 'Compare plusieurs offres du référentiel côte à côte avec prix min/max, avantages et engagement.',
  inputSchema: z.object({
    idOffres: z.array(z.string()).describe('Liste des IDs d\'offres à comparer'),
  }),
  execute: async ({ idOffres }) => {
    try {
      const { comparison } = compareOffresReferentiel(idOffres);
      
      return {
        success: true,
        count: comparison.length,
        comparison,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la comparaison',
      };
    }
  },
});

// =====================================================================
// TOOL 11: Get Offre Documents Référentiel
// =====================================================================
export const getOffreDocumentsRef = tool({
  description: 'Récupère les documents requis, modes de paiement et canaux d\'activation pour une offre du référentiel.',
  inputSchema: z.object({
    idOffre: z.string().describe("ID de l'offre"),
  }),
  execute: async ({ idOffre }) => {
    try {
      const result = getOffreDocuments(idOffre);
      
      if (!result.offre) {
        return {
          success: false,
          error: 'Offre introuvable',
        };
      }
      
      return {
        success: true,
        offre_nom: result.offre.nom_commercial,
        documents: result.documents,
        modes_paiement: result.modes_paiement,
        canaux_activation: result.canaux_activation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des documents',
      };
    }
  },
});
