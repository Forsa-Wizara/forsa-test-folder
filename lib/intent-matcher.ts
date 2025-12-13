// ============================================================================
// INTENT MATCHER - Détection instantanée des intentions courantes
// Bypass le LLM pour 80% des requêtes fréquentes → réponse <0.5s
// ============================================================================

import { dataPreloader } from './data-preloader';

export interface MatchResult {
  matched: boolean;
  intent?: string;
  data?: any;
  confidence: number;
  processingTimeMs: number;
}

export class IntentMatcher {
  private patterns = {
    // Conventions
    conventionsByPartner: [
      /\b(?:convention|offre[s]?|tarif[s]?)\s+(?:pour\s+)?(?:employ[ée]s?\s+)?(?:de\s+)?([A-Z])\b/i,
      /\b([A-Z])\s+(?:convention|offre[s]?|tarif[s]?)\b/i,
      /\b(?:partenaire|entreprise|établissement)\s+([A-Z])\b/i
    ],
    
    // Offres par nom
    offresByName: [
      /\b(idoom\s+(?:fibre|adsl|4g)\s+\w+)\b/i,
      /\b(moohtarif\s*\d*)\b/i,
      /\b(gamer[s]?|gaming)\b/i,
      /\boffre\s+([\w\s]+?)(?:\s+prix|\s+tarif|\s*\?|$)/i
    ],
    
    // Offres par famille
    offresByFamily: [
      /\b(?:offre[s]?|abonnement[s]?)\s+(internet|tv|pack|mobile|4g)\b/i,
      /\bfamille\s+([\w]+)\b/i
    ],
    
    // Depots par marque
    depotsByBrand: [
      /\b(buzz|zte|nubia)\s+(?:smartphone[s]?|téléphone[s]?|produit[s]?|prix)?\b/i,
      /\bsmartphone[s]?\s+(buzz|zte|nubia)\b/i,
      /\bmarque\s+([\w]+)\b/i
    ],
    
    // Depots par produit
    depotsByProduct: [
      /\b(buzz\s+\d+(?:\s+pro)?)\b/i,
      /\b(twin\s+box)\b/i,
      /\b(android\s+tv)\b/i,
      /\b(classateck|ekoteb|moalim)\b/i
    ],
    
    // Depots par catégorie
    depotsByCategory: [
      /\b(smartphone[s]?|téléphone[s]?|box\s+tv|accessoire[s]?|e-learning)\b/i,
      /\bcatégorie\s+([\w\s]+)\b/i
    ],
    
    // Questions générales
    general: [
      /\bbonjour\b/i,
      /\bsalut\b/i,
      /\baide\b/i,
      /\bcomment\s+ça\s+marche\b/i
    ]
  };

  match(query: string): MatchResult {
    const startTime = Date.now();
    
    // Test conventions par partenaire
    for (const pattern of this.patterns.conventionsByPartner) {
      const match = query.match(pattern);
      if (match) {
        const partner = match[1].toUpperCase();
        const conventions = dataPreloader.getConventionsByPartner(partner);
        if (conventions.length > 0) {
          return {
            matched: true,
            intent: 'conventions_by_partner',
            data: { partner, conventions },
            confidence: 0.95,
            processingTimeMs: Date.now() - startTime
          };
        }
      }
    }

    // Test offres par nom
    for (const pattern of this.patterns.offresByName) {
      const match = query.match(pattern);
      if (match) {
        const name = match[1];
        const offres = dataPreloader.searchOffres(name);
        if (offres.length > 0) {
          return {
            matched: true,
            intent: 'offres_by_name',
            data: { name, offres },
            confidence: 0.9,
            processingTimeMs: Date.now() - startTime
          };
        }
      }
    }

    // Test offres par famille
    for (const pattern of this.patterns.offresByFamily) {
      const match = query.match(pattern);
      if (match) {
        const famille = match[1];
        const offres = dataPreloader.getOffresByFamille(famille);
        if (offres.length > 0) {
          return {
            matched: true,
            intent: 'offres_by_family',
            data: { famille, offres },
            confidence: 0.85,
            processingTimeMs: Date.now() - startTime
          };
        }
      }
    }

    // Test depots par marque
    for (const pattern of this.patterns.depotsByBrand) {
      const match = query.match(pattern);
      if (match) {
        const marque = match[1];
        const depots = dataPreloader.getDepotsByMarque(marque);
        if (depots.length > 0) {
          return {
            matched: true,
            intent: 'depots_by_brand',
            data: { marque, depots },
            confidence: 0.9,
            processingTimeMs: Date.now() - startTime
          };
        }
      }
    }

    // Test depots par produit
    for (const pattern of this.patterns.depotsByProduct) {
      const match = query.match(pattern);
      if (match) {
        const product = match[1];
        const depot = dataPreloader.getDepotByName(product);
        if (depot) {
          return {
            matched: true,
            intent: 'depot_by_product',
            data: { product, depot },
            confidence: 0.95,
            processingTimeMs: Date.now() - startTime
          };
        }
        // Fallback: recherche partielle
        const depots = dataPreloader.searchDepots(product);
        if (depots.length > 0) {
          return {
            matched: true,
            intent: 'depots_by_product',
            data: { product, depots },
            confidence: 0.85,
            processingTimeMs: Date.now() - startTime
          };
        }
      }
    }

    // Test depots par catégorie
    for (const pattern of this.patterns.depotsByCategory) {
      const match = query.match(pattern);
      if (match) {
        const categorie = match[1];
        const depots = dataPreloader.getDepotsByCategorie(categorie);
        if (depots.length > 0) {
          return {
            matched: true,
            intent: 'depots_by_category',
            data: { categorie, depots },
            confidence: 0.85,
            processingTimeMs: Date.now() - startTime
          };
        }
      }
    }

    // Test questions générales
    for (const pattern of this.patterns.general) {
      if (pattern.test(query)) {
        return {
          matched: true,
          intent: 'general_greeting',
          data: { query },
          confidence: 0.8,
          processingTimeMs: Date.now() - startTime
        };
      }
    }

    // Pas de match
    return {
      matched: false,
      confidence: 0,
      processingTimeMs: Date.now() - startTime
    };
  }

  // Test batch pour analytics
  testBatch(queries: string[]): { matchRate: number; avgTimeMs: number } {
    let matched = 0;
    let totalTime = 0;

    queries.forEach(q => {
      const result = this.match(q);
      if (result.matched) matched++;
      totalTime += result.processingTimeMs;
    });

    return {
      matchRate: (matched / queries.length) * 100,
      avgTimeMs: totalTime / queries.length
    };
  }
}

// Instance globale
export const intentMatcher = new IntentMatcher();
