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
// TOOL 11: Query Depots (UNIFIED)
// =====================================================================
export const queryDepots = tool({
  description: 'Recherche et récupère les infos sur les produits dépôt-vente (smartphones, box, tablettes). Supporte les détails techniques, tarifs, SAV et notes en option.',
  inputSchema: z.object({
    // Search filters
    nom: z.string().optional().describe('Nom du produit (ex: "BUZZ 6", "ZTE Blade", "TWIN BOX", "ClassaTeck", "EKOTEB")'),
    categorie: z.string().optional().describe('Catégorie : SMARTPHONES, HARDWARE_MULTIMEDIA, ACCESSOIRES, SOLUTIONS_ELEARNING, SERVICES_DIGITAUX'),
    typeProduit: z.string().optional().describe('Type : SMARTPHONE, SMARTPHONE_PLIABLE, SMARTPHONE_PREMIUM, BOX_TV_ANDROID, CACHE_MODEM, PLATEFORME_PEDAGOGIQUE, BIBLIOTHEQUE_NUMERIQUE'),
    marque: z.string().optional().describe('Marque (ex: "BUZZ", "ZTE", "ZTE Nubia", "TWIN BOX")'),
    segment: z.string().optional().describe('Segment : PARTICULIERS, PROFESSIONNELS, ETUDIANTS, ENSEIGNANTS, FAMILLES'),
    partenaire: z.string().optional().describe('Partenaire (ex: "ACE Algérie", "SACOMI", "ClassaTeck", "Inkidia")'),
    maxPrice: z.number().optional().describe('Prix maximum en DA TTC'),
    hasReduction: z.boolean().optional().describe('Uniquement produits avec réduction ?'),
    // Optional detail flags
    includeDetails: z.boolean().optional().describe('Inclure toutes les caractéristiques techniques et tarifs détaillés'),
    includeSAV: z.boolean().optional().describe('Inclure les infos SAV, garantie, accessoires et avantages'),
    includeTarifs: z.boolean().optional().describe('Inclure uniquement les options tarifaires détaillées (sans SAV)'),
  }),
  execute: async ({ 
    nom, categorie, typeProduit, marque, segment, partenaire, maxPrice, hasReduction,
    includeDetails = false,
    includeSAV = false,
    includeTarifs = false,
  }) => {
    try {
      const results = searchDepotsVenteLib({
        nom,
        categorie,
        typeProduit,
        marque,
        segment,
        partenaire,
        maxPrice,
        hasReduction,
      });
      
      const produits = results.map(d => {
        const pricing = getProductPrice(d);
        const base = {
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

        // Include full details if requested
        if (includeDetails) {
          const depot = getDepotDetails(d.id_produit);
          const tarifs = getDepotTarifs(d.id_produit);
          
          return {
            ...base,
            // Technical specs
            reference_document: depot?.reference_document ?? null,
            specifications: depot?.specifications ?? null,
            // Full pricing
            tarification_options: tarifs.tarification_options,
            validite_jours: depot?.validite_jours ?? null,
            validite_mois: depot?.validite_mois ?? null,
            // Warranty & sales
            sav_partenaire: depot?.sav_partenaire ?? null,
            contact_sav: depot?.contact_sav ?? null,
            accessoires_inclus: depot?.accessoires_inclus ?? [],
            couverture_garantie: depot?.couverture_garantie ?? [],
            sav_procedure: depot?.sav_procedure ?? null,
            // Additional info
            notes: depot?.notes ?? [],
            avantages: depot?.avantages ?? [],
            avantages_cles: depot?.avantages_cles ?? [],
            points_forts: depot?.points_forts ?? [],
          };
        }

        // Include SAV info if requested
        if (includeSAV) {
          const savInfo = getDepotSAV(d.id_produit);
          const notesInfo = getDepotNotes(d.id_produit);
          
          return {
            ...base,
            sav_partenaire: savInfo.sav_partenaire,
            contact_sav: savInfo.contact_sav,
            couverture_garantie: savInfo.couverture_garantie,
            sav_procedure: savInfo.sav_procedure,
            accessoires_inclus: savInfo.accessoires_inclus,
            notes: notesInfo.notes,
            avantages: notesInfo.avantages,
            points_forts: notesInfo.points_forts,
          };
        }

        // Include tarifs only if requested
        if (includeTarifs) {
          const tarifs = getDepotTarifs(d.id_produit);
          
          return {
            ...base,
            tarification_options: tarifs.tarification_options,
          };
        }

        return base;
      });
      
      return {
        success: true,
        count: produits.length,
        produits,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la recherche',
        produits: [],
      };
    }
  },
});

// =====================================================================
// TOOL 12: Check Depot Eligibility
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
// TOOL 13: Compare Depots
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


