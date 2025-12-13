"use client"

import { useState } from 'react'
import Link from 'next/link'

export default function EvaluatePage() {
  const [inputJson, setInputJson] = useState(`{
  "equipe": "IA_Team",
  "question": {
    "categorie_01": {
      "1": "Donnez une description du projet",
      "2": "Quelles sont les technologies utilisées ?"
    }
  }
}`)
  const [outputJson, setOutputJson] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState<{total: number, current: number, currentQuestion: string}>({
    total: 0,
    current: 0,
    currentQuestion: ""
  })

  const handleEvaluate = async () => {
    setIsLoading(true)
    setError("")
    setOutputJson("")
    setProgress({ total: 0, current: 0, currentQuestion: "" })

    try {
      // Parse pour valider le JSON
      const parsedInput = JSON.parse(inputJson)

      // Compte le nombre total de questions
      let totalQuestions = 0
      for (const questions of Object.values(parsedInput.question)) {
        totalQuestions += Object.keys(questions as object).length
      }
      setProgress({ total: totalQuestions, current: 0, currentQuestion: "" })

      // Envoie la requête à l'API chat (supporte le format évaluation)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: inputJson
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la génération des réponses')
      }

      const result = await response.json()
      setOutputJson(JSON.stringify(result, null, 2))

    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(outputJson)
  }

  const handleDownloadOutput = () => {
    const blob = new Blob([outputJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reponses.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Pipeline d'évaluation JSON
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Générez automatiquement des réponses aux questions d'évaluation
            </p>
          </div>
          <Link 
            href="/"
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            ← Retour au chat
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonne gauche - Input */}
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Format d'entrée (Questions)
              </h2>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                <p>• <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">equipe</code>: Nom de l'équipe</p>
                <p>• <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">question</code>: Catégories de questions</p>
                <p className="ml-4">→ <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">ID categorie</code>: Questions par ID</p>
              </div>
            </div>

            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900 dark:text-zinc-100"
              placeholder="Collez votre JSON ici..."
            />

            <button
              onClick={handleEvaluate}
              disabled={isLoading}
              className="mt-4 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Traitement en cours... {progress.current}/{progress.total}
                </span>
              ) : (
                '🚀 Générer les réponses'
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-200 text-sm">❌ {error}</p>
              </div>
            )}

            {progress.total > 0 && isLoading && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                    Question {progress.current}/{progress.total}
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 text-xs">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </p>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div 
                    className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                {progress.currentQuestion && (
                  <p className="text-blue-700 dark:text-blue-300 text-xs mt-2">
                    📝 {progress.currentQuestion}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Colonne droite - Output */}
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Format de sortie (Réponses)
              </h2>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                <p>• <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">equipe</code>: Nom de l'équipe</p>
                <p>• <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">reponses</code>: Réponses par offre</p>
                <p className="ml-4">→ <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">Nom de l'offre</code>: Réponses par ID</p>
              </div>
            </div>

            <textarea
              value={outputJson}
              readOnly
              className="w-full h-96 p-4 font-mono text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              placeholder="Les réponses apparaîtront ici..."
            />

            {outputJson && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleCopyOutput}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  📋 Copier
                </button>
                <button
                  onClick={handleDownloadOutput}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  💾 Télécharger
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Documentation */}
        <div className="mt-8 p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            📚 Documentation
          </h3>
          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Format d'entrée</h4>
              <pre className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded text-xs overflow-x-auto">
{`{
  "equipe": "NomDeLEquipe",
  "question": {
    "ID categorie": {
      "ID question": "texte de la question"
    }
  }
}`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Format de sortie</h4>
              <pre className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded text-xs overflow-x-auto">
{`{
  "equipe": "NomDeLEquipe",
  "reponses": {
    "Nom de l'offre": {
      "ID question": "Réponse générée"
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
