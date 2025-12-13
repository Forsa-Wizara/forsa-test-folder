// ============================================================================
// LANGUAGE DETECTION - Détecte automatiquement la langue du message utilisateur
// ============================================================================

/**
 * Détecte si un texte contient de l'arabe
 */
export function containsArabic(text: string): boolean {
  // Plage Unicode pour l'arabe : U+0600 à U+06FF (arabe de base + extensions)
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
}

/**
 * Détecte si un texte contient du français
 */
export function containsFrench(text: string): boolean {
  // Caractères français spécifiques et mots courants
  const frenchCharsRegex = /[àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/;
  const commonFrenchWords = /\b(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|est|sont|avoir|être|pour|dans|sur|avec|quoi|quel|quelle)\b/i;
  
  return frenchCharsRegex.test(text) || commonFrenchWords.test(text);
}

/**
 * Détecte la langue principale d'un texte
 * @returns 'ar' pour arabe, 'fr' pour français, 'en' par défaut
 */
export function detectLanguage(text: string): 'ar' | 'fr' | 'en' {
  if (!text || text.trim().length === 0) {
    return 'fr'; // Défaut français
  }

  const hasArabic = containsArabic(text);
  const hasFrench = containsFrench(text);

  // Si les deux langues sont présentes, on compte les caractères
  if (hasArabic && hasFrench) {
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const latinChars = (text.match(/[a-zA-ZàâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/g) || []).length;
    
    return arabicChars > latinChars ? 'ar' : 'fr';
  }

  if (hasArabic) return 'ar';
  if (hasFrench) return 'fr';
  
  // Par défaut, si que de l'anglais ou autre
  return 'fr';
}

/**
 * Retourne un message d'attente contextualisé selon la langue
 */
export function getWaitMessage(language: 'ar' | 'fr' | 'en'): string {
  const messages = {
    ar: 'جاري البحث عن المعلومات...',
    fr: 'Je recherche les informations...',
    en: 'Searching for information...'
  };
  
  return messages[language] || messages.fr;
}

/**
 * Retourne des messages système traduits
 */
export function getSystemMessages(language: 'ar' | 'fr' | 'en') {
  const messages = {
    ar: {
      noResults: 'لم أجد أي نتائج لطلبك.',
      error: 'حدث خطأ أثناء البحث.',
      searching: 'جاري البحث...',
      found: 'وجدت',
      results: 'نتائج',
      price: 'السعر',
      available: 'متاح',
      notAvailable: 'غير متاح'
    },
    fr: {
      noResults: 'Je n\'ai trouvé aucun résultat pour votre demande.',
      error: 'Une erreur s\'est produite lors de la recherche.',
      searching: 'Recherche en cours...',
      found: 'J\'ai trouvé',
      results: 'résultats',
      price: 'Prix',
      available: 'Disponible',
      notAvailable: 'Non disponible'
    },
    en: {
      noResults: 'No results found for your request.',
      error: 'An error occurred during the search.',
      searching: 'Searching...',
      found: 'Found',
      results: 'results',
      price: 'Price',
      available: 'Available',
      notAvailable: 'Not available'
    }
  };
  
  return messages[language] || messages.fr;
}
