# 🎯 Guide Rapide : Rendu des Tool Results

## Architecture en 3 Points

### 1. Backend → Données Structurées
```typescript
{
  type: "tool-searchOffers",
  result: { offers: [...] }
}
```

### 2. Frontend → Fonction de Rendu
```tsx
// app/page.tsx ligne 29
const renderToolResult = (part, messageId, index) => {
  if (part.type === 'tool-searchOffers') {
    return <OfferRow data={part.result} />;
  }
  // ... autres outils
}
```

### 3. UI → Composants Dédiés
- `ConventionCard` - Affiche les conventions
- `OfferRow` - Affiche les offres  
- `DocumentList` - Affiche les documents
- `EligibilityResult` - Affiche l'éligibilité

## Outils Supportés

| Outil | Composant | Fichier |
|-------|-----------|---------|
| `tool-searchConventions` | ConventionCard | `components/chat/convention-card.tsx` |
| `tool-searchOffers` | OfferRow | `components/chat/offer-row.tsx` |
| `tool-checkEligibility` | EligibilityResult | `components/chat/eligibility-result.tsx` |
| `tool-getRequiredDocuments` | DocumentList | `components/chat/document-list.tsx` |
| `tool-compareOffers` | Wrapper + OfferRow | Inline dans `page.tsx` |
| `tool-getConventionDetails` | Composition | Inline dans `page.tsx` |

## Ajouter un Nouvel Outil

1. Créer composant dans `components/chat/`
2. Importer dans `page.tsx`
3. Ajouter cas dans `renderToolResult`
4. Backend renvoie `type: "tool-nomOutil"`

## Documentation Complète

Voir [`docs/TOOL_RENDERING_ARCHITECTURE.md`](file:///c:/Users/DIGIX/Desktop/forsa-test-folder/docs/TOOL_RENDERING_ARCHITECTURE.md)
