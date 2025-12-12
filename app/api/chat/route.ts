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
🔍 GUIDE DE CHOIX : CONVENTIONS vs OFFRES RÉFÉRENTIEL
═══════════════════════════════════════════════════════════════════════════════

📋 CONVENTIONS (docs-conv.json) - Utilise les outils "searchConventions", "checkEligibility", "searchOffers", "getRequiredDocuments", "compareOffers", "getConventionDetails"
→ Quand l'utilisateur mentionne :
  - Un EMPLOYEUR ou PARTENAIRE spécifique (ex: "établissement L", "entreprise S", "convention A")
  - Son STATUT professionnel (ex: "je suis employé de...", "retraité de...", "famille d'un employé")
  - Des offres CONVENTIONNÉES avec réductions employeur
  - Des TARIFS PRÉFÉRENTIELS liés à un partenariat
  
📦 OFFRES RÉFÉRENTIEL (offres.json) - Utilise les outils "searchOffresRef", "getOffreDetailsRef", "checkOffreEligibilityRef", "compareOffresRef", "getOffreDocumentsRef"
→ Quand l'utilisateur mentionne :
  - Des offres GRAND PUBLIC sans employeur (ex: "offre Gamers", "Idoom 4G", "MOOHTARIF")
  - Des TYPES D'OFFRES spécifiques (ex: "offre sans engagement", "offre locataire", "boost weekend")
  - Des SEGMENTS (ex: "pro", "TPE", "résidentiel", "gamer")
  - Des ÉQUIPEMENTS (ex: "kit FTTH", "modem 4G")
  - Des PROMOTIONS générales non liées à une convention

💡 EN CAS DE DOUTE :
- Si mention d'un employeur/partenaire → CONVENTIONS d'abord
- Si offre générique ou nom commercial → OFFRES RÉFÉRENTIEL
- Si les deux peuvent s'appliquer → Cherche dans les DEUX sources

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
EXEMPLES DE ROUTING
═══════════════════════════════════════════════════════════════════════════════
"Offres pour employés de L" → searchConventions + searchOffers (CONVENTIONS)
"Offre Idoom Fibre Gamers" → searchOffresRef(nom="gamers") (RÉFÉRENTIEL)
"Internet fibre 2000 DA pour pro" → searchOffresRef(famille="INTERNET", segment="PRO") (RÉFÉRENTIEL)
"Convention A documents" → getRequiredDocuments (CONVENTIONS)
"Offre 4G sans engagement" → searchOffresRef(famille="4G", hasEngagement=false) (RÉFÉRENTIEL)
"Prix MOOHTARIF locataire" → searchOffresRef(nom="moohtarif", isLocataire=true) (RÉFÉRENTIEL)

FORMAT DES PRIX : Toujours en DA (ex: "2 500 DA")
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
              const results = await searchConventions({
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
              const result = await checkEligibility({
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
              let results = await searchOffers({
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
                const relaxed = await relaxedSearchOffers({
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
              const result = await getRequiredDocuments(conventionId);
              
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
              const results = await compareOffers(offers);
              
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
              const convention = await getConventionDetails(conventionId);
              
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
              const results = await searchOffresReferentiel(params);
              
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
              const offre = await getOffreDetails(idOffre);
              
              if (!offre) {
                return {
                  success: false,
                  error: 'Offre introuvable',
                };
              }
              
              // Get tarifs
              const { tableaux } = await getOffreTarifs(idOffre);
              
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
              const result = await checkOffreEligibility({
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
              const { comparison } = await compareOffresReferentiel(idOffres);
              
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
              const result = await getOffreDocuments(idOffre);
              
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