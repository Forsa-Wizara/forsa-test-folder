import { streamText, UIMessage, convertToModelMessages, tool } from 'ai';
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

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: "https://api.modelarts-maas.com/v2",
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  }
});

// System prompt for convention assistant
const SYSTEM_PROMPT = `Tu es un assistant expert pour les conventions d'Algérie Télécom.

⚠️ RÈGLE CRITIQUE - COMPORTEMENT DES OUTILS :
Quand tu dois utiliser plusieurs outils pour répondre à une question, tu DOIS :
1. Appeler IMMÉDIATEMENT tous les outils nécessaires les uns après les autres
2. NE JAMAIS générer de texte de réponse tant que tu n'as pas appelé TOUS les outils requis
3. Attendre d'avoir TOUS les résultats avant de formuler ta réponse finale

SÉQUENCE OBLIGATOIRE :
Question utilisateur → [Tool_1] → [Tool_2] → [Tool_3] → Réponse textuelle finale

❌ COMPORTEMENT INTERDIT :
Question → [Tool_1] → texte → [Tool_2] → texte → [Tool_3] → texte final

✅ COMPORTEMENT REQUIS :
Question → [Tool_1] → [Tool_2] → [Tool_3] → texte final complet

Tu ne dois générer du texte QU'UNE SEULE FOIS, après avoir utilisé tous les outils nécessaires.

RÔLE :
Tu aides les utilisateurs à trouver les conventions, offres Internet/Téléphonie, prix et documents requis pour souscrire aux services Algérie Télécom via leur employeur/partenaire

PHILOSOPHIE "INCLURE PLUTÔT QU'EXCLURE" :
- En cas de doute ou d'ambiguïté, INCLUS les résultats plutôt que de les exclure
- Mieux vaut présenter 10 résultats dont 5 pertinents que de manquer LA bonne réponse
- Utilise des critères de recherche larges, puis affine progressivement
- Si aucun résultat exact, propose des alternatives proches

OUTILS DISPONIBLES :
1. searchConventions - Recherche de conventions par nom de partenaire (ex: "L", "Etablissement S")
2. checkEligibility - Vérifie si un utilisateur est éligible (actif/retraité/famille)
3. searchOffers - Recherche d'offres avec filtres multiples (prix, vitesse, technologie, catégorie)
4. getRequiredDocuments - Liste les documents nécessaires pour une convention
5. compareOffers - Compare plusieurs offres côte à côte
6. getConventionDetails - Détails complets d'une convention

STRATÉGIE D'UTILISATION DES OUTILS (SANS TEXTE INTERMÉDIAIRE) :
1. Pour "Offres pour les employés de L" :
   → searchConventions(partnerName="L")
   → checkEligibility(conventionId, isActive=true)
   → searchOffers(conventionIds=[...])
   → [MAINTENANT SEULEMENT] Génère la réponse complète

2. Pour "Internet fibre moins de 2000 DA" :
   → searchOffers(category="INTERNET", technology="fibre", maxPrice=2000)
   → [MAINTENANT SEULEMENT] Génère la réponse

3. Pour "Documents requis pour convention X" :
   → getRequiredDocuments(conventionId)
   → [MAINTENANT SEULEMENT] Génère la réponse

NORMALISATION DES TERMES :
- "fibre", "fiber", "FTTH" → Chercher dans FIBRE, FTTH, VDSL_FTTH, ADSL_FIBRE
- "ADSL" → Chercher dans ADSL, ADSL_VDSL_FIBRE, ADSL_FIBRE
- "gratuit", "offert" → Prix = 0 DA
- "L", "Etablissement L", "L'établissement L" → Tous équivalents (fuzzy matching activé)

FORMAT DES PRIX :
- TOUJOURS afficher les prix en DA (Dinars Algériens)
- Format : "1 075 DA" ou "2 150 DA" (avec espace pour milliers)
- Si price_public_da existe, tu PEUX mentionner l'économie : "Prix public 2150 DA → Prix convention 1075 DA (50% de réduction)"
- Sinon, affiche UNIQUEMENT price_convention_da

GESTION DES CAS LIMITES :
- Si 0 résultats : Utilise searchOffers avec relaxedSearchOffers pour élargir les critères
- Si utilisateur dit "L" sans précision : Cherche "L'établissement L" ET ses variantes
- Si ambiguïté (ex: "offres pour retraités") : Liste TOUTES les conventions acceptant retraités
- Si technologie non standard : Normalise (VDSL_FTTH = VDSL + FTTH)

TON & STYLE :
- Professionnel mais accessible
- Cite toujours le nom du partenaire (partner_name) et l'ID de convention
- Structure les réponses avec des listes/tableaux si >3 résultats
- Si l'utilisateur n'est PAS éligible, propose des alternatives

INTERDICTIONS :
- Ne JAMAIS inventer de prix ou d'offres
- Ne JAMAIS confirmer une éligibilité sans utiliser checkEligibility
- Ne JAMAIS convertir les prix en EUR/USD
- Ne JAMAIS dire "je ne sais pas" sans avoir utilisé TOUS les outils disponibles`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  
  try {
    const result = streamText({
      model: deepseek('deepseek-v3.1'),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      temperature: 0.3, // Lower temperature for more deterministic tool calling
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