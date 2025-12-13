// ============================================================================
// DATA LOADER - Charge les données FR ou AR selon la langue détectée
// ============================================================================

import fs from 'fs';
import path from 'path';

export type Language = 'ar' | 'fr';

interface DataFiles {
  conventions: string;
  depot: string;
  offres: string;
  ngbss: string;
}

const DATA_FILES: Record<Language, DataFiles> = {
  fr: {
    conventions: 'docs-conv.json',
    depot: 'depot.json',
    offres: 'offres.json',
    ngbss: 'ngbss.json',
  },
  ar: {
    conventions: 'arConv.json',
    depot: 'arDepot.json',
    offres: 'arOffre.json',
    ngbss: 'ngbss.json',   // À créer si besoin
  },
};

/**
 * Charge un fichier JSON de données
 */
function loadDataFile(filename: string): any {
  try {
    const filePath = path.join(process.cwd(), 'data', filename);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error loading data file ${filename}:`, error);
    return null;
  }
}

/**
 * Charge les données de conventions selon la langue
 */
export function loadConventionsData(language: Language = 'fr'): any {
  const filename = DATA_FILES[language].conventions;
  return loadDataFile(filename);
}

/**
 * Charge les données de dépôt-vente selon la langue
 */
export function loadDepotData(language: Language = 'fr'): any {
  const filename = DATA_FILES[language].depot;
  return loadDataFile(filename);
}

/**
 * Charge les données d'offres selon la langue
 */
export function loadOffresData(language: Language = 'fr'): any {
  const filename = DATA_FILES[language].offres;
  return loadDataFile(filename);
}

/**
 * Charge les données NGBSS selon la langue
 */
export function loadNGBSSData(language: Language = 'fr'): any {
  const filename = DATA_FILES[language].ngbss;
  return loadDataFile(filename);
}

/**
 * Charge toutes les données pour une langue donnée
 */
export function loadAllData(language: Language = 'fr'): {
  conventions: any;
  depot: any;
  offres: any;
  ngbss: any;
} {
  return {
    conventions: loadConventionsData(language),
    depot: loadDepotData(language),
    offres: loadOffresData(language),
    ngbss: loadNGBSSData(language),
  };
}

/**
 * Vérifie si un fichier de données existe pour une langue
 */
export function dataFileExists(dataType: keyof DataFiles, language: Language): boolean {
  const filename = DATA_FILES[language][dataType];
  const filePath = path.join(process.cwd(), 'data', filename);
  return fs.existsSync(filePath);
}

/**
 * Retourne la liste des fichiers de données disponibles
 */
export function getAvailableDataFiles(): Record<Language, Partial<DataFiles>> {
  const available: Record<Language, Partial<DataFiles>> = {
    fr: {},
    ar: {},
  };

  for (const lang of ['fr', 'ar'] as Language[]) {
    for (const dataType of ['conventions', 'depot', 'offres', 'ngbss'] as (keyof DataFiles)[]) {
      if (dataFileExists(dataType, lang)) {
        available[lang][dataType] = DATA_FILES[lang][dataType];
      }
    }
  }

  return available;
}
