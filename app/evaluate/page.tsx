"use client"

import { useState } from "react"

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

  const handleEvaluate = async () => {
    setIsLoading(true)
    setError("")
    setOutputJson("")

    try {
      // Parse pour valider le JSON
      const parsedInput = JSON.parse(inputJson)
      
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedInput),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de l\'évaluation')
      }

      const result = await response.json()
      setOutputJson(JSON.stringify(result, null, 2))
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement')
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
        <div className="mb-8">
          <a 
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            Retour
          </a>
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Pipeline d'Évaluation Automatisée
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Traitez vos questions JSON et générez des réponses standardisées
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne Input */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-black dark:text-white">
                Questions (JSON d'entrée)
              </h2>
              <button
                onClick={() => setInputJson(`{
  "equipe": "IA_Team",
  "question": {
    "categorie_01": {
      "1": "Donnez une description du projet",
      "2": "Quelles sont les technologies utilisées ?"
    }
  }
}`)}
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
              >
                Exemple
              </button>
            </div>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="w-full h-[400px] p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white font-mono text-sm resize-none focus:outline-none focus:border-black dark:focus:border-white"
              placeholder="Collez votre JSON ici..."
            />
            
            <button
              onClick={handleEvaluate}
              disabled={isLoading}
              className="w-full mt-4 px-6 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-5 w-5 border-2 border-white dark:border-black border-t-transparent rounded-full" />
                  Traitement en cours...
                </span>
              ) : (
                'Générer les réponses'
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Colonne Output */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-black dark:text-white">
                Réponses (JSON de sortie)
              </h2>
              {outputJson && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyOutput}
                    className="text-sm px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Copier
                  </button>
                  <button
                    onClick={handleDownloadOutput}
                    className="text-sm px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Télécharger
                  </button>
                </div>
              )}
            </div>
            <div className="w-full h-[400px] p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 overflow-auto">
              {outputJson ? (
                <pre className="text-black dark:text-white font-mono text-sm whitespace-pre-wrap">
                  {outputJson}
                </pre>
              ) : (
                <p className="text-zinc-400 dark:text-zinc-600 text-sm">
                  Les réponses générées apparaîtront ici...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Documentation */}
        <div className="mt-8 p-6 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-3">
            📋 Format JSON
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-black dark:text-white mb-2">Entrée:</h4>
              <pre className="bg-white dark:bg-zinc-800 p-3 rounded-lg text-zinc-700 dark:text-zinc-300 overflow-auto">
{`{
  "equipe": "NomEquipe",
  "question": {
    "ID_categorie": {
      "ID_question": "question"
    }
  }
}`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-black dark:text-white mb-2">Sortie:</h4>
              <pre className="bg-white dark:bg-zinc-800 p-3 rounded-lg text-zinc-700 dark:text-zinc-300 overflow-auto">
{`{
  "equipe": "NomEquipe",
  "reponses": {
    "Nom_offre": {
      "ID_question": "Réponse"
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
