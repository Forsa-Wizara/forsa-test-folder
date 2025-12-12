import { streamText,stepCountIs , UIMessage, convertToModelMessages, tool } from 'ai';
import { z } from 'zod';
import { createDeepSeek } from '@ai-sdk/deepseek';
import {
  searchConventions,
  checkEligibility,
  searchOffers,
  getRequiredDocuments,
  getConventionDetails,
  compareOffers,
  relaxedSearchOffers,
} from '@/lib/conventions';
import {
  searchOffresReferentiel,
  getOffreDetails,
  getOffreTarifs,
  checkOffreEligibility,
  compareOffresReferentiel,
  getOffreDocuments,
  listFamilles,
} from '@/lib/offres';
import {
  searchDepotsVente,
  getDepotDetails,
  getDepotTarifs,
  checkDepotEligibility,
  compareDepotsVente,
  getDepotSAV,
  getDepotNotes,
  getProductPrice,
} from '@/lib/depot';

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: "https://api.modelarts-maas.com/v2",
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  }
});

// System prompt for convention assistant
const SYSTEM_PROMPT = `Tu es un assistant expert pour Algérie Télécom.

⚠️ RÈGLE CRITIQUE - COMPORTEMENT DES OUTILS :
1. Appeler IMMÉDIATEMENT tous les outils nécessaires les uns après les autres
2. NE JAMAIS générer de texte avant d'avoir appelé TOUS les outils requis
3. Attendre d'avoir TOUS les résultats avant de formuler ta réponse finale

═══════════════════════════════════════════════════════════════════════════════
🔍 GUIDE DE CHOIX : 3 SOURCES DE DONNÉES
═══════════════════════════════════════════════════════════════════════════════

📋 CONVENTIONS (docs-conv.json) - Outils: searchConventions, checkEligibility, searchOffers, getRequiredDocuments, compareOffers, getConventionDetails
→ Quand l'utilisateur mentionne :
  - Un EMPLOYEUR ou PARTENAIRE spécifique (ex: "établissement L", "entreprise S", "convention A")
  - Son STATUT professionnel (ex: "je suis employé de...", "retraité de...", "famille d'un employé")
  - Des offres CONVENTIONNÉES avec réductions employeur
  - Des TARIFS PRÉFÉRENTIELS liés à un partenariat
  
📦 OFFRES RÉFÉRENTIEL (offres.json) - Outils: searchOffresRef, getOffreDetailsRef, checkOffreEligibilityRef, compareOffresRef, getOffreDocumentsRef
→ Quand l'utilisateur mentionne :
  - Des offres GRAND PUBLIC sans employeur (ex: "offre Gamers", "Idoom 4G", "MOOHTARIF")
  - Des TYPES D'OFFRES spécifiques (ex: "offre sans engagement", "offre locataire", "boost weekend")
  - Des SEGMENTS (ex: "pro", "TPE", "résidentiel", "gamer")
  - Des ÉQUIPEMENTS liés aux offres (ex: "modem 4G offert")

🛒 DÉPÔTS VENTE (depot.json) - Outils: searchDepotsVente, getDepotDetailsRef, checkDepotEligibilityRef, compareDepotsRef, getDepotSAVRef
→ Quand l'utilisateur mentionne :
  - Des SMARTPHONES (ex: "BUZZ 6", "ZTE Blade", "Nubia")
  - Des BOX TV (ex: "TWIN BOX", "Android TV")
  - Des ACCESSOIRES (ex: "cache modem", "finitions premium")
  - Des SOLUTIONS E-LEARNING (ex: "ClassaTeck", "EKOTEB", "Dorouscom", "MOALIM")
  - Des MARQUES (ex: "BUZZ", "ZTE", "ZTE Nubia")
  - Des PARTENAIRES (ex: "SARL ACE Algérie", "SACOMI", "Inkidia")
  - Le terme "dépôt-vente" ou "dépôt vente"

💡 EN CAS DE DOUTE :
- Employeur/partenaire mentionné → CONVENTIONS
- Offre commerciale/abonnement → OFFRES RÉFÉRENTIEL  
- Équipement/produit à acheter → DÉPÔTS VENTE
- Si les sources peuvent se combiner → Cherche dans PLUSIEURS sources

═══════════════════════════════════════════════════════════════════════════════
OUTILS CONVENTIONS (6 outils)
═══════════════════════════════════════════════════════════════════════════════
1. searchConventions - Recherche conventions par nom partenaire
2. checkEligibility - Vérifie éligibilité (actif/retraité/famille)
3. searchOffers - Recherche offres conventionnées (prix, vitesse, tech)
4. getRequiredDocuments - Documents pour une convention
5. compareOffers - Compare offres conventionnées
6. getConventionDetails - Détails complets d'une convention

═══════════════════════════════════════════════════════════════════════════════
OUTILS OFFRES RÉFÉRENTIEL (5 outils)
═══════════════════════════════════════════════════════════════════════════════
1. searchOffresRef - Recherche offres par famille/tech/segment/prix
2. getOffreDetailsRef - Détails complets d'une offre
3. checkOffreEligibilityRef - Vérifie éligibilité (locataire/conventionne/segment)
4. compareOffresRef - Compare plusieurs offres référentiel
5. getOffreDocumentsRef - Documents et canaux d'activation

═══════════════════════════════════════════════════════════════════════════════
OUTILS DÉPÔTS VENTE (5 outils)
═══════════════════════════════════════════════════════════════════════════════
1. searchDepotsVente - Recherche produits par catégorie/marque/segment/prix/partenaire
2. getDepotDetailsRef - Détails complets d'un produit (specs, prix, couleurs)
3. checkDepotEligibilityRef - Vérifie éligibilité par segment
4. compareDepotsRef - Compare plusieurs produits dépôt-vente
5. getDepotSAVRef - SAV, garantie, accessoires inclus et notes

═══════════════════════════════════════════════════════════════════════════════
EXEMPLES DE ROUTING
═══════════════════════════════════════════════════════════════════════════════
"Offres pour employés de L" → CONVENTIONS (searchConventions + searchOffers)
"Offre Idoom Fibre Gamers" → OFFRES (searchOffresRef)
"Smartphones BUZZ" → DÉPÔTS (searchDepotsVente)
"ZTE Blade A55" → DÉPÔTS (searchDepotsVente + getDepotDetailsRef)
"TWIN BOX prix" → DÉPÔTS (searchDepotsVente)
"Abonnement EKOTEB" → DÉPÔTS (searchDepotsVente)
"ClassaTeck pack professionnel" → DÉPÔTS (searchDepotsVente)
"Cache modem premium" → DÉPÔTS (searchDepotsVente)

FORMAT DES PRIX : Toujours en DA (ex: "11 000 DA TTC")
TON : Professionnel mais accessible
STRUCTURE : Listes/tableaux si >3 résultats`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  
  try {
    const result = streamText({
      model: deepseek('deepseek-v3.1'),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      temperature: 0.3,
      stopWhen: stepCountIs(5),
      tools: {
        // =====================================================================
        // TOOL 1: Search Conventions
        // =====================================================================
        searchConventions: tool({
          description: 'Recherche des conventions par nom de partenaire, alias, ou type de client (B2C/B2B). Utilise le fuzzy matching pour trouver des correspondances même avec des fautes de frappe. Retourne une liste de conventions avec leurs IDs, noms, et éligibilités.',
          inputSchema: z.object({
            partnerName: z.string().optional().describe('Nom du partenaire ou alias (ex: "L", "Etablissement S", "A"). Le fuzzy matching est automatique.'),
            clientType: z.enum(['B2C', 'B2B']).optional().describe('Type de client : B2C (particuliers) ou B2B (entreprises)'),
          }),
          execute: async ({ partnerName, clientType }) => {
            try {
              const results = searchConventions({
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
        }),

        // =====================================================================
        // TOOL 2: Check Eligibility
        // =====================================================================
        checkEligibility: tool({
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
              const result = checkEligibility({
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
        }),

        // =====================================================================
        // TOOL 3: Search Offers
        // =====================================================================
        searchOffers: tool({
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
              let results = searchOffers({
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
        }),

        // =====================================================================
        // TOOL 4: Get Required Documents
        // =====================================================================
        getRequiredDocuments: tool({
          description: 'Récupère la liste complète des documents requis pour souscrire à une convention spécifique. Retourne un tableau de chaînes de caractères décrivant chaque document.',
          inputSchema: z.object({
            conventionId: z.string().describe("ID de la convention (ex: 'conv_l', 'conv_s')"),
          }),
          execute: async ({ conventionId }) => {
            try {
              const result = getRequiredDocuments(conventionId);
              
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
        }),

        // =====================================================================
        // TOOL 5: Compare Offers
        // =====================================================================
        compareOffers: tool({
          description: 'Compare plusieurs offres côte à côte avec calcul automatique des économies si prix public disponible. Utile pour aider l\'utilisateur à choisir entre plusieurs options.',
          inputSchema: z.object({
            offers: z.array(z.object({
              conventionId: z.string().describe('ID de la convention'),
              offerIndex: z.number().describe('Index de l\'offre dans le tableau offers (commence à 0)'),
            })).describe('Liste des offres à comparer'),
          }),
          execute: async ({ offers }) => {
            try {
              const results = compareOffers(offers);
              
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
        }),

        // =====================================================================
        // TOOL 6: Get Convention Details
        // =====================================================================
        getConventionDetails: tool({
          description: 'Récupère TOUS les détails d\'une convention : éligibilité complète, documents, toutes les offres, notes. Utilise cet outil pour avoir une vue exhaustive d\'une convention.',
          inputSchema: z.object({
            conventionId: z.string().describe("ID de la convention (ex: 'conv_l', 'conv_s')"),
          }),
          execute: async ({ conventionId }) => {
            try {
              const convention = getConventionDetails(conventionId);
              
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
        }),

        // =====================================================================
        // TOOL 7: Search Offres Référentiel
        // =====================================================================
        searchOffresRef: tool({
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
        }),

        // =====================================================================
        // TOOL 8: Get Offre Details Référentiel
        // =====================================================================
        getOffreDetailsRef: tool({
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
        }),

        // =====================================================================
        // TOOL 9: Check Offre Eligibility Référentiel
        // =====================================================================
        checkOffreEligibilityRef: tool({
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
              const result = checkOffreEligibility({
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
        }),

        // =====================================================================
        // TOOL 10: Compare Offres Référentiel
        // =====================================================================
        compareOffresRef: tool({
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
        }),

        // =====================================================================
        // TOOL 11: Get Offre Documents Référentiel
        // =====================================================================
        getOffreDocumentsRef: tool({
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
        }),

        // =====================================================================
        // TOOL 12: Search Dépôts Vente
        // =====================================================================
        searchDepotsVente: tool({
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
              const results = searchDepotsVente(params);
              
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
        }),

        // =====================================================================
        // TOOL 13: Get Depot Details
        // =====================================================================
        getDepotDetailsRef: tool({
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
        }),

        // =====================================================================
        // TOOL 14: Check Depot Eligibility
        // =====================================================================
        checkDepotEligibilityRef: tool({
          description: 'Vérifie si un utilisateur est éligible à un produit dépôt-vente selon son segment.',
          inputSchema: z.object({
            idProduit: z.string().describe("ID du produit à vérifier"),
            segment: z.string().optional().describe('Segment : PARTICULIERS, PROFESSIONNELS, ETUDIANTS, ENSEIGNANTS, FAMILLES'),
          }),
          execute: async ({ idProduit, segment }) => {
            try {
              const result = checkDepotEligibility({
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
        }),

        // =====================================================================
        // TOOL 15: Compare Depots
        // =====================================================================
        compareDepotsRef: tool({
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
        }),

        // =====================================================================
        // TOOL 16: Get Depot SAV & Notes
        // =====================================================================
        getDepotSAVRef: tool({
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
        }),
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Une erreur est survenue lors du traitement de votre demande.' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}