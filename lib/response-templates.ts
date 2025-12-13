// ============================================================================
// RESPONSE TEMPLATES - Réponses pré-générées pour vitesse maximale
// Génère des réponses formatées instantanément sans appel LLM
// ============================================================================

interface Convention {
  id: string;
  partenaire: string;
  offres?: any[];
  conditions_eligibilite?: any;
  [key: string]: any;
}

interface Offre {
  id: string;
  nom: string;
  prix?: any;
  vitesse?: any;
  [key: string]: any;
}

interface Depot {
  id: string;
  nom: string;
  prix?: string;
  marque?: string;
  categorie?: string;
  [key: string]: any;
}

export class ResponseTemplates {
  
  // ============================================================================
  // CONVENTIONS
  // ============================================================================
  
  generateConventionsByPartner(partner: string, conventions: Convention[]): string {
    if (conventions.length === 0) {
      return `Aucune convention trouvée pour le partenaire ${partner}.`;
    }

    if (conventions.length === 1) {
      const conv = conventions[0];
      let response = `📋 **Convention ${conv.partenaire}**\n\n`;
      
      if (conv.offres && conv.offres.length > 0) {
        response += `✅ **${conv.offres.length} offre(s) disponible(s)**\n\n`;
        conv.offres.slice(0, 5).forEach((offre: any, idx: number) => {
          response += `${idx + 1}. **${offre.nom || offre.designation}**`;
          if (offre.prix_ttc || offre.tarif_ttc) {
            response += ` - ${offre.prix_ttc || offre.tarif_ttc} DA/mois`;
          }
          if (offre.vitesse_down) {
            response += ` (${offre.vitesse_down})`;
          }
          response += '\n';
        });
      }
      
      if (conv.conditions_eligibilite) {
        response += `\n📌 **Éligibilité** : ${this.formatEligibilite(conv.conditions_eligibilite)}`;
      }
      
      return response;
    }

    // Plusieurs conventions
    let response = `📋 **${conventions.length} convention(s) trouvée(s) pour ${partner}**\n\n`;
    conventions.forEach((conv, idx) => {
      response += `${idx + 1}. ${conv.partenaire}`;
      if (conv.offres) {
        response += ` (${conv.offres.length} offres)`;
      }
      response += '\n';
    });
    
    return response;
  }

  // ============================================================================
  // OFFRES
  // ============================================================================
  
  generateOffresByName(name: string, offres: Offre[]): string {
    if (offres.length === 0) {
      return `Aucune offre trouvée pour "${name}".`;
    }

    if (offres.length === 1) {
      return this.formatOffreDetails(offres[0]);
    }

    let response = `📦 **${offres.length} offre(s) trouvée(s) : "${name}"**\n\n`;
    offres.forEach((offre, idx) => {
      response += this.formatOffreSummary(offre, idx + 1);
    });
    
    return response;
  }

  generateOffresByFamily(famille: string, offres: Offre[]): string {
    if (offres.length === 0) {
      return `Aucune offre dans la famille ${famille}.`;
    }

    let response = `📦 **Offres ${famille.toUpperCase()}** (${offres.length} disponible(s))\n\n`;
    offres.slice(0, 10).forEach((offre, idx) => {
      response += this.formatOffreSummary(offre, idx + 1);
    });
    
    if (offres.length > 10) {
      response += `\n... et ${offres.length - 10} autre(s) offre(s).`;
    }
    
    return response;
  }

  private formatOffreDetails(offre: Offre): string {
    let response = `📦 **${offre.nom}**\n\n`;
    
    if (offre.prix) {
      const prix = typeof offre.prix === 'object' ? offre.prix.montant_ttc : offre.prix;
      response += `💰 **Prix** : ${prix} DA/mois\n`;
    }
    
    if (offre.vitesse) {
      response += `⚡ **Vitesse** : ${offre.vitesse.down || offre.vitesse}\n`;
    }
    
    if ((offre as any).description) {
      response += `\n📝 ${(offre as any).description}\n`;
    }
    
    return response;
  }

  private formatOffreSummary(offre: Offre, index: number): string {
    let line = `${index}. **${offre.nom}**`;
    
    if (offre.prix) {
      const prix = typeof offre.prix === 'object' ? offre.prix.montant_ttc : offre.prix;
      line += ` - ${prix} DA/mois`;
    }
    
    if (offre.vitesse) {
      const vitesse = typeof offre.vitesse === 'object' ? offre.vitesse.down : offre.vitesse;
      line += ` (${vitesse})`;
    }
    
    line += '\n';
    return line;
  }

  // ============================================================================
  // DEPOTS
  // ============================================================================
  
  generateDepotsByBrand(marque: string, depots: Depot[]): string {
    if (depots.length === 0) {
      return `Aucun produit ${marque} trouvé dans le dépôt-vente.`;
    }

    let response = `🛒 **Produits ${marque.toUpperCase()}** (${depots.length} disponible(s))\n\n`;
    depots.forEach((depot, idx) => {
      response += this.formatDepotSummary(depot, idx + 1);
    });
    
    return response;
  }

  generateDepotByProduct(product: string, depot: Depot): string {
    let response = `🛒 **${depot.nom}**\n\n`;
    
    if (depot.marque) {
      response += `🏷️ **Marque** : ${depot.marque}\n`;
    }
    
    if (depot.prix) {
      response += `💰 **Prix** : ${depot.prix} DA\n`;
    }
    
    if (depot.categorie) {
      response += `📁 **Catégorie** : ${depot.categorie}\n`;
    }
    
    if ((depot as any).caracteristiques) {
      response += `\n✨ **Caractéristiques**\n`;
      const specs = (depot as any).caracteristiques;
      Object.keys(specs).slice(0, 5).forEach(key => {
        response += `  • ${key} : ${specs[key]}\n`;
      });
    }
    
    return response;
  }

  generateDepotsByProduct(product: string, depots: Depot[]): string {
    if (depots.length === 0) {
      return `Aucun produit trouvé pour "${product}".`;
    }

    if (depots.length === 1) {
      return this.generateDepotByProduct(product, depots[0]);
    }

    let response = `🛒 **${depots.length} produit(s) trouvé(s) : "${product}"**\n\n`;
    depots.forEach((depot, idx) => {
      response += this.formatDepotSummary(depot, idx + 1);
    });
    
    return response;
  }

  generateDepotsByCategory(categorie: string, depots: Depot[]): string {
    if (depots.length === 0) {
      return `Aucun produit dans la catégorie ${categorie}.`;
    }

    let response = `🛒 **${categorie.toUpperCase()}** (${depots.length} produit(s))\n\n`;
    depots.slice(0, 10).forEach((depot, idx) => {
      response += this.formatDepotSummary(depot, idx + 1);
    });
    
    if (depots.length > 10) {
      response += `\n... et ${depots.length - 10} autre(s) produit(s).`;
    }
    
    return response;
  }

  private formatDepotSummary(depot: Depot, index: number): string {
    let line = `${index}. **${depot.nom}**`;
    
    if (depot.prix) {
      line += ` - ${depot.prix} DA`;
    }
    
    if (depot.marque) {
      line += ` (${depot.marque})`;
    }
    
    line += '\n';
    return line;
  }

  // ============================================================================
  // GENERAL
  // ============================================================================
  
  generateGreeting(): string {
    return `👋 Bonjour ! Je suis votre assistant Algérie Télécom.

Je peux vous aider à :
• 📋 Consulter les conventions partenaires
• 📦 Explorer les offres Internet, TV et Mobile
• 🛒 Découvrir les produits du dépôt-vente (smartphones, box TV, e-learning)

Comment puis-je vous aider aujourd'hui ?`;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  private formatEligibilite(eligibilite: any): string {
    if (typeof eligibilite === 'string') return eligibilite;
    if (eligibilite.statut_actif) return 'Employés actifs';
    if (eligibilite.statut_retraite) return 'Retraités et employés actifs';
    return 'Conditions spécifiques';
  }
}

// Instance globale
export const responseTemplates = new ResponseTemplates();
