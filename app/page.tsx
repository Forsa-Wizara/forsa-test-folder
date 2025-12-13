"use client"

import { useChat } from "@ai-sdk/react"
import { useState, useEffect, useRef } from "react"

// ============================================================================
// UI COMPONENTS (Compatible avec chat.tsx)
// ============================================================================

interface ConventionCardProps {
  data: {
    convention_id: string
    partner_name: string
    aliases?: string[]
    client_type?: string
    eligibility?: any
    offers_count?: number
  }
}

function ConventionCard({ data }: ConventionCardProps) {
  return (
    <div className="border border-zinc-300 rounded-lg p-4 bg-zinc-50 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-bold text-zinc-900 text-lg">{data.partner_name}</h3>
          {data.aliases && data.aliases.length > 0 && (
            <p className="text-xs text-zinc-600">Alias: {data.aliases.join(", ")}</p>
          )}
        </div>
        <span className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700">{data.convention_id}</span>
      </div>

      {data.client_type && (
        <div className="mb-2">
          <span className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700">{data.client_type}</span>
        </div>
      )}

      {data.eligibility && (
        <div className="flex flex-wrap gap-2 mb-2">
          {data.eligibility.active && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700">✓ Actifs</span>
          )}
          {data.eligibility.retired && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700">✓ Retraités</span>
          )}
          {data.eligibility.family && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700">✓ Famille</span>
          )}
        </div>
      )}

      {data.offers_count !== undefined && (
        <p className="text-sm text-zinc-600 mt-2">
          {data.offers_count} offre{data.offers_count > 1 ? "s" : ""} disponible{data.offers_count > 1 ? "s" : ""}
        </p>
      )}
    </div>
  )
}

interface OfferRowProps {
  offer: {
    category?: string
    technology?: string
    speed_mbps?: number
    plan?: string
    price_convention_da: number
    price_public_da?: number
    discount?: string
    condition?: string
    label?: string
    note?: string
  }
  partnerName?: string
  conventionId?: string
}

function OfferRow({ offer, partnerName, conventionId }: OfferRowProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-DZ").format(price) + " DA"
  }

  return (
    <div className="border border-zinc-300 rounded-lg p-4 bg-zinc-50 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700 font-medium">{offer.category}</span>
            {offer.technology && (
              <span className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700">{offer.technology}</span>
            )}
            {offer.condition && (
              <span className="text-xs px-2 py-1 rounded bg-zinc-200 text-zinc-700">{offer.condition}</span>
            )}
          </div>

          {offer.speed_mbps && <p className="text-sm text-zinc-900 font-semibold">{offer.speed_mbps} Mbps</p>}

          {offer.plan && <p className="text-sm text-zinc-900 font-semibold">{offer.plan}</p>}

          {offer.label && <p className="text-xs text-zinc-600">{offer.label}</p>}
        </div>

        <div className="text-right">
          <div className="text-lg font-bold text-zinc-900">{formatPrice(offer.price_convention_da)}</div>

          {offer.price_public_da && (
            <div className="text-xs text-zinc-500 line-through">{formatPrice(offer.price_public_da)}</div>
          )}

          {offer.discount && <div className="text-xs text-zinc-700 font-medium">-{offer.discount}</div>}
        </div>
      </div>

      {partnerName && (
        <p className="text-xs text-zinc-500 mt-2">
          {partnerName} {conventionId && `(${conventionId})`}
        </p>
      )}

      {offer.note && <p className="text-xs text-zinc-700 mt-2 italic">ℹ️ {offer.note}</p>}
    </div>
  )
}

interface DocumentListProps {
  documents: string[]
  partnerName?: string
  notes?: string
}

function DocumentList({ documents, partnerName, notes }: DocumentListProps) {
  return (
    <div className="border border-zinc-300 rounded-lg p-4 bg-zinc-50 mb-3">
      <h4 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
        📄 Documents requis
        {partnerName && <span className="text-sm font-normal text-zinc-600">({partnerName})</span>}
      </h4>
      <ul className="space-y-2">
        {documents.map((doc, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700">
            <span className="text-zinc-900 mt-1">✓</span>
            <span>{doc}</span>
          </li>
        ))}
      </ul>
      {notes && <p className="text-xs text-zinc-700 mt-3 pt-3 border-t border-zinc-300 italic">ℹ️ {notes}</p>}
    </div>
  )
}

interface EligibilityResultProps {
  data: {
    eligible: boolean
    reasons: string[]
    convention_name?: string
  }
}

function EligibilityResult({ data }: EligibilityResultProps) {
  return (
    <div
      className={`border rounded-lg p-4 mb-3 ${
        data.eligible ? "border-zinc-300 bg-zinc-50" : "border-zinc-400 bg-zinc-100"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl text-zinc-900">{data.eligible ? "✓" : "✗"}</span>
        <h4 className="font-bold text-zinc-900">{data.eligible ? "Éligible" : "Non éligible"}</h4>
        {data.convention_name && <span className="text-sm text-zinc-600">• {data.convention_name}</span>}
      </div>
      <ul className="space-y-1 ml-8">
        {data.reasons.map((reason, idx) => (
          <li key={idx} className="text-sm text-zinc-700">
            {reason}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================================
// MAIN CHAT COMPONENT
// ============================================================================

export default function Page() {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isLoading = status === "streaming"

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = (text: string) => {
    sendMessage({ text })
    setInput("")
  }

  const renderToolResult = (part: any, messageId: string, index: number) => {
    const key = `${messageId}-${index}`

    // Search Conventions Tool
    if (part.type === "tool-searchConventions" && part.result?.conventions) {
      return (
        <div key={key} className="my-3">
          {part.result.conventions.map((conv: any, idx: number) => (
            <ConventionCard key={`${key}-conv-${idx}`} data={conv} />
          ))}
        </div>
      )
    }

    // Check Eligibility Tool
    if (part.type === "tool-checkEligibility" && part.result) {
      return (
        <div key={key} className="my-3">
          <EligibilityResult data={part.result} />
        </div>
      )
    }

    // Search Offers Tool
    if (part.type === "tool-searchOffers" && part.result?.offers) {
      return (
        <div key={key} className="my-3">
          {part.result.relaxed && part.result.relaxedCriteria && (
            <div className="mb-3 p-3 rounded-lg bg-zinc-100 border border-zinc-300">
              <p className="text-sm text-zinc-900 font-medium mb-1">⚠️ Critères de recherche élargis :</p>
              <ul className="text-xs text-zinc-700 ml-4">
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
      )
    }

    // Get Required Documents Tool
    if (part.type === "tool-getRequiredDocuments" && part.result?.documents) {
      return (
        <div key={key} className="my-3">
          <DocumentList
            documents={part.result.documents}
            partnerName={part.result.partner_name}
            notes={part.result.notes}
          />
        </div>
      )
    }

    // Compare Offers Tool
    if (part.type === "tool-compareOffers" && part.result?.comparison) {
      return (
        <div key={key} className="my-3">
          <div className="border border-zinc-300 rounded-lg p-4 bg-zinc-50 mb-3">
            <h4 className="font-bold text-zinc-900 mb-3">📊 Comparaison des offres</h4>
            {part.result.comparison.map((item: any, idx: number) => (
              <div key={`${key}-comp-${idx}`} className="mb-3 last:mb-0">
                <OfferRow offer={item.offer} partnerName={item.partner_name} conventionId={item.convention_id} />
                {item.savings && (
                  <p className="text-sm text-zinc-900 mt-1 ml-4">
                    💰 Économie : {new Intl.NumberFormat("fr-DZ").format(item.savings)} DA ({item.savingsPercent})
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Get Convention Details Tool
    if (part.type === "tool-getConventionDetails" && part.result?.convention) {
      const conv = part.result.convention
      return (
        <div key={key} className="my-3">
          <ConventionCard data={conv} />
          {conv.documents && conv.documents.length > 0 && (
            <DocumentList documents={conv.documents} notes={conv.notes} />
          )}
          {conv.offers && conv.offers.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-bold text-zinc-900 mb-2">Offres disponibles :</h4>
              {conv.offers.map((offer: any, idx: number) => (
                <OfferRow key={`${key}-detail-offer-${idx}`} offer={offer} />
              ))}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  // État initial: interface centrée comme v0
  if (messages.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        {/* Contenu centré */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-3xl mx-auto text-center mb-12">
            {/* Logo/Icône */}
            <div className="w-16 h-16 mx-auto rounded-full bg-black flex items-center justify-center mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-8 h-8"
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </div>
            {/* Titre et description */}
            <h1 className="text-3xl md:text-4xl font-bold text-black mb-3">Assistant Algerie Telecom</h1>
            <p className="text-zinc-600 text-lg mb-8">
              Posez vos questions sur les offres, prix, éligibilité et documents requis
            </p>
            
            {/* Lien vers évaluation */}
            <a 
              href="/evaluate"
              className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-colors text-sm font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Pipeline d'évaluation JSON
            </a>

            {/* Formulaire de saisie central */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (input.trim()) {
                  handleSendMessage(input)
                }
              }}
              className="mb-8"
            >
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      if (input.trim()) {
                        handleSendMessage(input)
                      }
                    }
                  }}
                  placeholder="Décrivez votre besoin..."
                  disabled={isLoading}
                  rows={1}
                  className="w-full min-h-[120px] max-h-[300px] resize-none rounded-2xl border-2 border-zinc-300 bg-white px-6 py-4 text-base text-black placeholder:text-zinc-400 focus:outline-none focus:border-black disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="absolute bottom-4 right-4 h-10 w-10 inline-flex items-center justify-center rounded-full bg-black text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                  )}
                </button>
              </div>
            </form>

            {/* Suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {[
                "Quelles sont les offres pour les employés de l'établissement L ?",
                "donne moi toutes les offres de -20 % ",
                 "Quel documents sont requis pour beneficier des avantages de la convention S",
                "Donne moi des offres téléphonie pour retraités",
              ].map((text, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(text)}
                  className="p-4 border border-zinc-300 rounded-xl hover:border-black hover:bg-zinc-50 transition-colors text-sm text-left text-zinc-700 hover:text-black"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Après le premier message: interface de chat classique
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header minimaliste */}
      <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-zinc-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-black">Assistant Algerie Telecom</span>
          </div>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.map((message) => {
            const isUser = message.role === "user"
            return (
              <div key={message.id} className="mb-6 flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    isUser ? "bg-zinc-100 text-zinc-900" : "bg-black text-white"
                  }`}
                >
                  {isUser ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="M12 8V4H8" />
                      <rect width="16" height="12" x="4" y="8" rx="2" />
                      <path d="M2 14h2" />
                      <path d="M20 14h2" />
                      <path d="M15 13v2" />
                      <path d="M9 13v2" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2 overflow-hidden">
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <div key={`${message.id}-${i}`} className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap leading-relaxed m-0 text-zinc-900">{part.text}</p>
                        </div>
                      )
                    }

                    return renderToolResult(part, message.id, i)
                  })}
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-black text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2" />
                  <path d="M20 14h2" />
                  <path d="M15 13v2" />
                  <path d="M9 13v2" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-zinc-600">
                  <div className="animate-spin h-4 w-4 border-2 border-zinc-600 border-t-transparent rounded-full" />
                  <span className="text-sm">Recherche en cours...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form - En bas */}
      <div className="border-t border-zinc-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (input.trim()) {
              handleSendMessage(input)
            }
          }}
          className="p-4 max-w-3xl mx-auto"
        >
          <div className="relative flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (input.trim()) {
                    handleSendMessage(input)
                  }
                }
              }}
              placeholder="Posez votre question..."
              disabled={isLoading}
              rows={1}
              className="flex-1 min-h-[56px] max-h-[200px] resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-black placeholder:text-zinc-500 focus:outline-none focus:border-black disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-[56px] w-[56px] shrink-0 inline-flex items-center justify-center rounded-xl bg-black text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
