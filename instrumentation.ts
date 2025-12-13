// ============================================================================
// 🚀 INSTRUMENTATION - Hook Next.js qui s'exécute AU DÉMARRAGE du serveur
// ============================================================================
// Ce fichier est chargé AVANT toute requête, garantissant le warm-up complet
// Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔥 [INSTRUMENTATION] Démarrage du warm-up global...');
    const globalStartTime = Date.now();

    try {
      // Import dynamique pour éviter les problèmes de bundling
      const { loadConventions } = await import('./lib/conventions');
      const { loadOffres } = await import('./lib/offres');
      const { loadDepots } = await import('./lib/depot');

      // Charger toutes les données en parallèle
      await Promise.all([
        Promise.resolve(loadConventions()),
        Promise.resolve(loadOffres()),
        Promise.resolve(loadDepots()),
      ]);

      const globalDuration = Date.now() - globalStartTime;
      console.log(`🚀 [INSTRUMENTATION] Warm-up terminé en ${globalDuration}ms`);
      console.log(`✅ Système prêt - Toutes les requêtes seront ultra-rapides dès maintenant !`);
    } catch (error) {
      console.error('❌ [INSTRUMENTATION] Erreur lors du warm-up:', error);
    }
  }
}
