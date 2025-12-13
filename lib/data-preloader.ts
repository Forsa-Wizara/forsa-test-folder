// ============================================================================
// PRÉCHARGEMENT ET INDEXATION DES DONNÉES POUR ACCÈS O(1)
// Charge toutes les données au démarrage pour éliminer les I/O pendant les requêtes
// ============================================================================

import conventionsData from '@/data/docs-conv.json';
import offresData from '@/data/offres.json';
import depotsData from '@/data/depot.json';

interface Convention {
  id: string;
  partenaire: string;
  type_client: string;
  offres: any[];
  documents?: any[];
  [key: string]: any;
}

interface Offre {
  id: string;
  nom: string;
  famille?: string;
  segment?: string;
  [key: string]: any;
}

interface Depot {
  id: string;
  nom: string;
  categorie?: string;
  marque?: string;
  [key: string]: any;
}

// ============================================================================
// INDEXES GLOBAUX - Pré-calculés au chargement du module
// ============================================================================

class DataPreloader {
  // Conventions
  private conventionsById = new Map<string, Convention>();
  private conventionsByPartner = new Map<string, Convention[]>();
  
  // Offres
  private offresById = new Map<string, Offre>();
  private offresByName = new Map<string, Offre>();
  private offresByFamille = new Map<string, Offre[]>();
  
  // Depots
  private depotsById = new Map<string, Depot>();
  private depotsByName = new Map<string, Depot>();
  private depotsByMarque = new Map<string, Depot[]>();
  private depotsByCategorie = new Map<string, Depot[]>();
  
  // Stats
  public stats = {
    totalConventions: 0,
    totalOffres: 0,
    totalDepots: 0,
    loadTimeMs: 0
  };

  constructor() {
    const startTime = Date.now();
    this.loadAllData();
    this.stats.loadTimeMs = Date.now() - startTime;
    console.log(`📦 Data preloaded in ${this.stats.loadTimeMs}ms:`);
    console.log(`   - ${this.stats.totalConventions} conventions`);
    console.log(`   - ${this.stats.totalOffres} offres`);
    console.log(`   - ${this.stats.totalDepots} depots`);
  }

  private loadAllData() {
    this.loadConventions();
    this.loadOffres();
    this.loadDepots();
  }

  private loadConventions() {
    const conventions = (conventionsData as any) || [];
    
    conventions.forEach((conv: any) => {
      const convention: Convention = {
        id: conv.convention_id || conv.id,
        partenaire: conv.partner_name || conv.partenaire,
        type_client: conv.client_type || conv.type_client,
        offres: conv.offers || conv.offres || [],
        documents: conv.documents || [],
        ...conv
      };
      
      this.conventionsById.set(convention.id, convention);
      
      // Index par partenaire (lowercase pour recherche case-insensitive)
      const partnerKey = convention.partenaire.toLowerCase();
      if (!this.conventionsByPartner.has(partnerKey)) {
        this.conventionsByPartner.set(partnerKey, []);
      }
      this.conventionsByPartner.get(partnerKey)!.push(convention);
    });
    
    this.stats.totalConventions = conventions.length;
  }

  private loadOffres() {
    const offres = (offresData as any).referentiel_offres || [];
    
    offres.forEach((off: any) => {
      const offre: Offre = {
        id: off.id_offre || off.id,
        nom: off.nom_commercial || off.nom,
        famille: off.famille,
        segment: off.segments_cibles?.[0] || off.segment,
        ...off
      };
      
      this.offresById.set(offre.id, offre);
      this.offresByName.set(offre.nom.toLowerCase(), offre);
      
      // Index par famille
      if (offre.famille) {
        const familleKey = offre.famille.toLowerCase();
        if (!this.offresByFamille.has(familleKey)) {
          this.offresByFamille.set(familleKey, []);
        }
        this.offresByFamille.get(familleKey)!.push(offre);
      }
    });
    
    this.stats.totalOffres = offres.length;
  }

  private loadDepots() {
    const depots = (depotsData as any).referentiel_produits_depot_vente || [];
    
    depots.forEach((dep: any) => {
      const depot: Depot = {
        id: dep.id_produit || dep.id,
        nom: dep.nom_produit || dep.nom,
        categorie: dep.categorie,
        marque: dep.marque,
        ...dep
      };
      
      this.depotsById.set(depot.id, depot);
      this.depotsByName.set(depot.nom.toLowerCase(), depot);
      
      // Index par marque
      if (depot.marque) {
        const marqueKey = depot.marque.toLowerCase();
        if (!this.depotsByMarque.has(marqueKey)) {
          this.depotsByMarque.set(marqueKey, []);
        }
        this.depotsByMarque.get(marqueKey)!.push(depot);
      }
      
      // Index par catégorie
      if (depot.categorie) {
        const catKey = depot.categorie.toLowerCase();
        if (!this.depotsByCategorie.has(catKey)) {
          this.depotsByCategorie.set(catKey, []);
        }
        this.depotsByCategorie.get(catKey)!.push(depot);
      }
    });
    
    this.stats.totalDepots = depots.length;
  }

  // ============================================================================
  // API PUBLIQUE - Accès O(1) aux données
  // ============================================================================

  // Conventions
  getConventionById(id: string): Convention | undefined {
    return this.conventionsById.get(id);
  }

  getConventionsByPartner(partner: string): Convention[] {
    return this.conventionsByPartner.get(partner.toLowerCase()) || [];
  }

  getAllConventions(): Convention[] {
    return Array.from(this.conventionsById.values());
  }

  searchConventions(query: string): Convention[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.conventionsById.values()).filter(conv => 
      conv.partenaire.toLowerCase().includes(lowerQuery) ||
      conv.id.toLowerCase().includes(lowerQuery)
    );
  }

  // Offres
  getOffreById(id: string): Offre | undefined {
    return this.offresById.get(id);
  }

  getOffreByName(name: string): Offre | undefined {
    return this.offresByName.get(name.toLowerCase());
  }

  getOffresByFamille(famille: string): Offre[] {
    return this.offresByFamille.get(famille.toLowerCase()) || [];
  }

  getAllOffres(): Offre[] {
    return Array.from(this.offresById.values());
  }

  searchOffres(query: string): Offre[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.offresById.values()).filter(off => 
      off.nom.toLowerCase().includes(lowerQuery) ||
      (off.famille && off.famille.toLowerCase().includes(lowerQuery))
    );
  }

  // Depots
  getDepotById(id: string): Depot | undefined {
    return this.depotsById.get(id);
  }

  getDepotByName(name: string): Depot | undefined {
    return this.depotsByName.get(name.toLowerCase());
  }

  getDepotsByMarque(marque: string): Depot[] {
    return this.depotsByMarque.get(marque.toLowerCase()) || [];
  }

  getDepotsByCategorie(categorie: string): Depot[] {
    return this.depotsByCategorie.get(categorie.toLowerCase()) || [];
  }

  getAllDepots(): Depot[] {
    return Array.from(this.depotsById.values());
  }

  searchDepots(query: string): Depot[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.depotsById.values()).filter(dep => 
      dep.nom.toLowerCase().includes(lowerQuery) ||
      (dep.marque && dep.marque.toLowerCase().includes(lowerQuery)) ||
      (dep.categorie && dep.categorie.toLowerCase().includes(lowerQuery))
    );
  }
}

// ============================================================================
// INSTANCE GLOBALE - Chargée une seule fois au démarrage
// ============================================================================

export const dataPreloader = new DataPreloader();
