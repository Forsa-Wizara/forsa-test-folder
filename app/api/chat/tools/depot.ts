import { tool } from 'ai';
import { z } from 'zod';
import {
  searchDepotsVente as searchDepotsVenteLib,
  getDepotDetails,
  getDepotTarifs,
  checkDepotEligibility as checkDepotEligibilityLib,
  compareDepotsVente,
  getDepotSAV,
  getDepotNotes,
  getProductPrice,
} from '@/lib/depot';

// =====================================================================
// TOOL 12: Search Dépôts Vente
// =====================================================================
export const searchDepotsVente = tool({
  description: 'Recherche dans le catalogue des produits dépôt-vente (smartphones BUZZ/ZTE, TWIN BOX, cache modems, e-learning). Filtres : catégorie, marque, segment, prix, partenaire.',
  inputSchema: z.object({
    nom: z.string().optional().describe('Nom du produit (ex: "BUZZ 6", "ZTE Blade", "TWIN BOX", "ClassaTeck", "EKOTEB")'),
    categorie: z.string().optional().describe('Catégorie : SMARTPHONES, HARDWARE_MULTIMEDIA, ACCESSOIRES, SOLUTIONS_ELEARNING, SERVICES_DIGITAUX'),
    typeProduit: z.string().optional().describe('Type : SMARTPHONE, SMARTPHONE_PLIABLE, SMARTPHONE_PREMIUM, BOX_TV_ANDROID, CACHE_MODEM, PLATEFORME_PEDAGOGIQUE, BIBLIOTHEQUE_NUMERIQUE'),
    marque: z.string().optional().describe('Marque (ex: "BUZZ", "ZTE", "ZTE Nubia", "TWIN BOX")'),
    segment: z.string().optional().describe('Segment : PARTICULIERS, PROFESSIONNELS, ETUDIANTS, ENSEIGNANTS, FAMILLES'),
    partenaire: z.string().optional().describe('Partenaire (ex: "ACE Algérie", "SACOMI", "ClassaTeck", "Inkidia")'),
    maxPrice: z.number().optional().describe('Prix maximum en DA TTC'),
    hasReduction: z.boolean().optional().describe('Uniquement produits avec réduction ?'),
  }),
  execute: async (params) => {
    try {
      const results = searchDepotsVenteLib(params);
      
      return {
        success: true,
        count: results.length,
        produits: results.map(d => {
          const pricing = getProductPrice(d);
          return {
            id_produit: d.id_produit,
            nom_produit: d.nom_produit,
            categorie: d.categorie,
            type_produit: d.type_produit,
            marque: d.marque ?? null,
            modele: d.modele ?? null,
            partenaire: d.partenaire ?? null,
            segments_cibles: d.segments_cibles ?? [],
            prix_principal: pricing.prix_principal,
            prix_ancien: pricing.prix_ancien,
            reduction_percentage: pricing.reduction_percentage,
            economie_da: pricing.economie_da,
            couleurs: d.couleurs ?? [],
            garantie_mois: d.garantie_mois ?? null,
            canaux_vente: d.canaux_vente ?? [],
          };
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la recherche de produits',
        produits: [],
      };
    }
  },
});

// =====================================================================
// TOOL 13: Get Depot Details
// =====================================================================
export const getDepotDetailsRef = tool({
  description: 'Récupère TOUS les détails d\'un produit dépôt-vente : spécifications, tarifs, couleurs, accessoires, SAV.',
  inputSchema: z.object({
    idProduit: z.string().describe("ID du produit (ex: 'buzz_6_pro', 'zte_blade_a55', 'twin_box_tv', 'classroom_pack_initial')"),
  }),
  execute: async ({ idProduit }) => {
    try {
      const depot = getDepotDetails(idProduit);
      
      if (!depot) {
        return {
          success: false,
          error: 'Produit introuvable',
        };
      }
      
      const tarifs = getDepotTarifs(idProduit);
      
      return {
        success: true,
        produit: {
          id_produit: depot.id_produit,
          nom_produit: depot.nom_produit,
          categorie: depot.categorie,
          type_produit: depot.type_produit,
          marque: depot.marque ?? null,
          modele: depot.modele ?? null,
          partenaire: depot.partenaire ?? null,
          reference_document: depot.reference_document ?? null,
          specifications: depot.specifications ?? null,
          couleurs: depot.couleurs ?? [],
          segments_cibles: depot.segments_cibles ?? [],
          // Pricing
          prix_principal: tarifs.prix_principal,
          prix_ancien: tarifs.prix_ancien,
          reduction_percentage: tarifs.reduction_percentage,
          economie_da: tarifs.economie_da,
          tarification_options: tarifs.tarification_options,
          validite_jours: depot.validite_jours ?? null,
          validite_mois: depot.validite_mois ?? null,
          // Sales & warranty
          canaux_vente: depot.canaux_vente ?? [],
          garantie_mois: depot.garantie_mois ?? null,
          sav_partenaire: depot.sav_partenaire ?? null,
          contact_sav: depot.contact_sav ?? null,
          accessoires_inclus: depot.accessoires_inclus ?? [],
          couverture_garantie: depot.couverture_garantie ?? [],
          sav_procedure: depot.sav_procedure ?? null,
          // Additional info
          notes: depot.notes ?? [],
          avantages: depot.avantages ?? [],
          avantages_cles: depot.avantages_cles ?? [],
          points_forts: depot.points_forts ?? [],
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
// TOOL 14: Check Depot Eligibility
// =====================================================================
export const checkDepotEligibilityRef = tool({
  description: 'Vérifie si un utilisateur est éligible à un produit dépôt-vente selon son segment.',
  inputSchema: z.object({
    idProduit: z.string().describe("ID du produit à vérifier"),
    segment: z.string().optional().describe('Segment : PARTICULIERS, PROFESSIONNELS, ETUDIANTS, ENSEIGNANTS, FAMILLES'),
  }),
  execute: async ({ idProduit, segment }) => {
    try {
      const result = checkDepotEligibilityLib({
        idProduit,
        segment,
      });
      
      return {
        success: true,
        eligible: result.eligible,
        reasons: result.reasons,
        produit_nom: result.depot?.nom_produit ?? null,
        canaux_vente: result.canaux_vente,
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
// TOOL 15: Compare Depots
// =====================================================================
export const compareDepotsRef = tool({
  description: 'Compare plusieurs produits dépôt-vente côte à côte avec prix, garantie et canaux de vente.',
  inputSchema: z.object({
    idProduits: z.array(z.string()).describe('Liste des IDs de produits à comparer (ex: ["buzz_6_pro", "zte_blade_a55"])'),
  }),
  execute: async ({ idProduits }) => {
    try {
      const { comparison } = compareDepotsVente(idProduits);
      
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
// TOOL 16: Get Depot SAV & Notes
// =====================================================================
export const getDepotSAVRef = tool({
  description: 'Récupère les infos SAV, garantie, accessoires inclus, avantages et notes pour un produit dépôt-vente.',
  inputSchema: z.object({
    idProduit: z.string().describe("ID du produit"),
  }),
  execute: async ({ idProduit }) => {
    try {
      const savInfo = getDepotSAV(idProduit);
      const notesInfo = getDepotNotes(idProduit);
      
      if (!savInfo.depot) {
        return {
          success: false,
          error: 'Produit introuvable',
        };
      }
      
      return {
        success: true,
        produit_nom: savInfo.depot.nom_produit,
        garantie_mois: savInfo.garantie_mois,
        sav_partenaire: savInfo.sav_partenaire,
        contact_sav: savInfo.contact_sav,
        couverture_garantie: savInfo.couverture_garantie,
        sav_procedure: savInfo.sav_procedure,
        accessoires_inclus: savInfo.accessoires_inclus,
        notes: notesInfo.notes,
        avantages: notesInfo.avantages,
        points_forts: notesInfo.points_forts,
        canaux_vente: notesInfo.canaux_vente,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des infos SAV',
      };
    }
  },
});
