'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';

// ============================================================================
// UI COMPONENTS
// ============================================================================

interface ConventionCardProps {
  data: {
    convention_id: string;
    partner_name: string;
    aliases?: string[];
    client_type?: string;
    eligibility?: any;
    offers_count?: number;
  };
}

function ConventionCard({ data }: ConventionCardProps) {
  return (
    <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-950/30 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-bold text-blue-100 text-lg">{data.partner_name}</h3>
          {data.aliases && data.aliases.length > 0 && (
            <p className="text-xs text-zinc-400">Alias: {data.aliases.join(', ')}</p>
          )}
        </div>
        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
          {data.convention_id}
        </span>
      </div>
      
      {data.client_type && (
        <div className="mb-2">
          <span className={`text-xs px-2 py-1 rounded ${
            data.client_type === 'B2C' ? 'bg-green-500/20 text-green-300' : 'bg-purple-500/20 text-purple-300'
          }`}>
            {data.client_type}
          </span>
        </div>
      )}
      
      {data.eligibility && (
        <div className="flex flex-wrap gap-2 mb-2">
          {data.eligibility.active && (
            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300">
              ✓ Actifs
            </span>
          )}
          {data.eligibility.retired && (
            <span className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-300">
              ✓ Retraités
            </span>
          )}
          {data.eligibility.family && (
            <span className="text-xs px-2 py-1 rounded bg-pink-500/20 text-pink-300">
              ✓ Famille
            </span>
          )}
        </div>
      )}
      
      {data.offers_count !== undefined && (
        <p className="text-sm text-zinc-400 mt-2">
          {data.offers_count} offre{data.offers_count > 1 ? 's' : ''} disponible{data.offers_count > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

interface OfferRowProps {
  offer: {
    category?: string;
    technology?: string;
    speed_mbps?: number;
    plan?: string;
    price_convention_da: number;
    price_public_da?: number;
    discount?: string;
    condition?: string;
    label?: string;
    note?: string;
  };
  partnerName?: string;
  conventionId?: string;
}

function OfferRow({ offer, partnerName, conventionId }: OfferRowProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-DZ').format(price) + ' DA';
  };

  return (
    <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-950/30 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-medium">
              {offer.category}
            </span>
            {offer.technology && (
              <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                {offer.technology}
              </span>
            )}
            {offer.condition && (
              <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">
                {offer.condition}
              </span>
            )}
          </div>
          
          {offer.speed_mbps && (
            <p className="text-sm text-zinc-300 font-semibold">
              {offer.speed_mbps} Mbps
            </p>
          )}
          
          {offer.plan && (
            <p className="text-sm text-zinc-300 font-semibold">
              {offer.plan}
            </p>
          )}
          
          {offer.label && (
            <p className="text-xs text-zinc-400">{offer.label}</p>
          )}
        </div>
        
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-300">
            {formatPrice(offer.price_convention_da)}
          </div>
          
          {offer.price_public_da && (
            <div className="text-xs text-zinc-500 line-through">
              {formatPrice(offer.price_public_da)}
            </div>
          )}
          
          {offer.discount && (
            <div className="text-xs text-emerald-400 font-medium">
              -{offer.discount}
            </div>
          )}
        </div>
      </div>
      
      {partnerName && (
        <p className="text-xs text-zinc-500 mt-2">
          {partnerName} {conventionId && `(${conventionId})`}
        </p>
      )}
      
      {offer.note && (
        <p className="text-xs text-yellow-400 mt-2 italic">
          ℹ️ {offer.note}
        </p>
      )}
    </div>
  );
}

interface DocumentListProps {
  documents: string[];
  partnerName?: string;
  notes?: string;
}

function DocumentList({ documents, partnerName, notes }: DocumentListProps) {
  return (
    <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-950/30 mb-3">
      <h4 className="font-bold text-amber-100 mb-3 flex items-center gap-2">
        📄 Documents requis
        {partnerName && <span className="text-sm font-normal text-zinc-400">({partnerName})</span>}
      </h4>
      <ul className="space-y-2">
        {documents.map((doc, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className="text-amber-400 mt-1">✓</span>
            <span>{doc}</span>
          </li>
        ))}
      </ul>
      {notes && (
        <p className="text-xs text-amber-300 mt-3 pt-3 border-t border-amber-500/20 italic">
          ℹ️ {notes}
        </p>
      )}
    </div>
  );
}

interface EligibilityResultProps {
  data: {
    eligible: boolean;
    reasons: string[];
    convention_name?: string;
  };
}

function EligibilityResult({ data }: EligibilityResultProps) {
  return (
    <div className={`border rounded-lg p-4 mb-3 ${
      data.eligible 
        ? 'border-green-500/30 bg-green-950/30' 
        : 'border-red-500/30 bg-red-950/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-2xl ${data.eligible ? 'text-green-400' : 'text-red-400'}`}>
          {data.eligible ? '✓' : '✗'}
        </span>
        <h4 className={`font-bold ${data.eligible ? 'text-green-100' : 'text-red-100'}`}>
          {data.eligible ? 'Éligible' : 'Non éligible'}
        </h4>
        {data.convention_name && (
          <span className="text-sm text-zinc-400">• {data.convention_name}</span>
        )}
      </div>
      <ul className="space-y-1 ml-8">
        {data.reasons.map((reason, idx) => (
          <li key={idx} className={`text-sm ${data.eligible ? 'text-green-300' : 'text-red-300'}`}>
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// MAIN CHAT COMPONENT
// ============================================================================

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === 'streaming';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderToolResult = (part: any, messageId: string, index: number) => {
    const key = `${messageId}-${index}`;
    
    // Search Conventions Tool
    if (part.type === 'tool-searchConventions' && part.result?.conventions) {
      return (
        <div key={key} className="my-3">
          {part.result.conventions.map((conv: any, idx: number) => (
            <ConventionCard key={`${key}-conv-${idx}`} data={conv} />
          ))}
        </div>
      );
    }
    
    // Check Eligibility Tool
    if (part.type === 'tool-checkEligibility' && part.result) {
      return (
        <div key={key} className="my-3">
          <EligibilityResult data={part.result} />
        </div>
      );
    }
    
    // Search Offers Tool
    if (part.type === 'tool-searchOffers' && part.result?.offers) {
      return (
        <div key={key} className="my-3">
          {part.result.relaxed && part.result.relaxedCriteria && (
            <div className="mb-3 p-3 rounded-lg bg-yellow-900/30 border border-yellow-500/30">
              <p className="text-sm text-yellow-300 font-medium mb-1">
                ⚠️ Critères de recherche élargis :
              </p>
              <ul className="text-xs text-yellow-200 ml-4">
                {part.result.relaxedCriteria.map((criteria: string, idx: number) => (
                  <li key={idx}>• {criteria}</li>
                ))}
              </ul>
            </div>
          )}
          {part.result.offers.map((item: any, idx: number) => (
            <OfferRow 
              key={`${key}-offer-${idx}`} 
              offer={item.offer}
              partnerName={item.partner_name}
              conventionId={item.convention_id}
            />
          ))}
        </div>
      );
    }
    
    // Get Required Documents Tool
    if (part.type === 'tool-getRequiredDocuments' && part.result?.documents) {
      return (
        <div key={key} className="my-3">
          <DocumentList 
            documents={part.result.documents}
            partnerName={part.result.partner_name}
            notes={part.result.notes}
          />
        </div>
      );
    }
    
    // Compare Offers Tool
    if (part.type === 'tool-compareOffers' && part.result?.comparison) {
      return (
        <div key={key} className="my-3">
          <div className="border border-violet-500/30 rounded-lg p-4 bg-violet-950/30 mb-3">
            <h4 className="font-bold text-violet-100 mb-3">📊 Comparaison des offres</h4>
            {part.result.comparison.map((item: any, idx: number) => (
              <div key={`${key}-comp-${idx}`} className="mb-3 last:mb-0">
                <OfferRow 
                  offer={item.offer}
                  partnerName={item.partner_name}
                  conventionId={item.convention_id}
                />
                {item.savings && (
                  <p className="text-sm text-green-400 mt-1 ml-4">
                    💰 Économie : {new Intl.NumberFormat('fr-DZ').format(item.savings)} DA ({item.savingsPercent})
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Get Convention Details Tool
    if (part.type === 'tool-getConventionDetails' && part.result?.convention) {
      const conv = part.result.convention;
      return (
        <div key={key} className="my-3">
          <ConventionCard data={conv} />
          {conv.documents && conv.documents.length > 0 && (
            <DocumentList 
              documents={conv.documents}
              notes={conv.notes}
            />
          )}
          {conv.offers && conv.offers.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-bold text-zinc-300 mb-2">Offres disponibles :</h4>
              {conv.offers.map((offer: any, idx: number) => (
                <OfferRow 
                  key={`${key}-detail-offer-${idx}`} 
                  offer={offer}
                />
              ))}
            </div>
          )}
        </div>
      );
    }
    
    // Fallback: render raw JSON for unknown tools
    if (part.type.startsWith('tool-')) {
      return (
        <details key={key} className="my-2">
          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
            Debug: {part.type}
          </summary>
          <pre className="text-xs text-zinc-600 bg-zinc-900 p-2 rounded mt-1 overflow-x-auto">
            {JSON.stringify(part, null, 2)}
          </pre>
        </details>
      );
    }
    
    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4 bg-zinc-900">
        <h1 className="text-xl font-bold text-zinc-100">
          🇩🇿 Assistant Conventions Algérie Télécom
        </h1>
        <p className="text-sm text-zinc-400">
          Posez vos questions sur les offres, prix, éligibilité et documents requis
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 mt-12">
              <p className="text-lg mb-4">👋 Bienvenue !</p>
              <p className="text-sm mb-2">Exemples de questions :</p>
              <ul className="text-xs space-y-1">
                <li>• "Quelles sont les offres pour les employés de l'établissement L ?"</li>
                <li>• "Internet fibre moins de 2000 DA"</li>
                <li>• "Documents requis pour convention S"</li>
                <li>• "Offres téléphonie pour retraités"</li>
              </ul>
            </div>
          )}
          
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl rounded-lg p-4 ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-zinc-800 text-zinc-100'
              }`}>
                {message.role === 'user' && (
                  <div className="text-sm mb-1 font-medium opacity-70">Vous</div>
                )}
                
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    return (
                      <div key={`${message.id}-${i}`} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );
                  }
                  
                  return renderToolResult(part, message.id, i);
                })}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 text-zinc-400 rounded-lg p-4 max-w-3xl">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse">💭</div>
                  <span className="text-sm">Recherche en cours...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-900 p-4">
        <form
          onSubmit={e => {
            e.preventDefault();
            if (input.trim()) {
              sendMessage({ text: input });
              setInput('');
            }
          }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex gap-2">
            <input
              className="flex-1 bg-zinc-800 text-zinc-100 p-3 rounded-lg border border-zinc-700 focus:border-blue-500 focus:outline-none placeholder-zinc-500"
              value={input}
              placeholder="Posez votre question sur les conventions..."
              onChange={e => setInput(e.currentTarget.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
            >
              Envoyer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}