// ============================================================================
// LANGUAGE CONTEXT - Variable globale pour partager la langue détectée
// ============================================================================

export type Language = 'ar' | 'fr';

// Variable globale pour stocker la langue courante
let currentLanguage: Language = 'fr';

/**
 * Définit la langue courante de l'application
 */
export function setCurrentLanguage(language: Language): void {
  currentLanguage = language;
  console.log(`🌐 Current language set to: ${language}`);
}

/**
 * Récupère la langue courante de l'application
 */
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

/**
 * Réinitialise la langue à la valeur par défaut (français)
 */
export function resetLanguage(): void {
  currentLanguage = 'fr';
}
