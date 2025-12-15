import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validation du format d'entrée
    if (!body.equipe || !body.question) {
      return NextResponse.json(
        { error: 'Format invalide. "equipe" et "question" sont requis.' },
        { status: 400 }
      );
    }

    const { equipe, question } = body;
    
    // Structure de sortie - garde les mêmes clés qu'en entrée
    const reponses: Record<string, Record<string, string>> = {};
    
    // Traite chaque catégorie
    for (const [categorieId, questions] of Object.entries(question)) {
      console.log(`\n📁 Processing category: ${categorieId}`);
      
      // Initialise la catégorie dans les réponses
      reponses[categorieId] = {};
      
      // Pour chaque question dans la catégorie
      for (const [questionId, questionText] of Object.entries(questions as Record<string, string>)) {
        console.log(`\n❓ Question ${questionId}: "${questionText}"`);
        
        try {
          // Format EXACT utilisé par le frontend (vérifie dans page.tsx)
          const uiMessages = [
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              role: 'user',
              content: questionText,
              createdAt: new Date()
            }
          ];
          
          const origin = req.headers.get('origin') || 'http://localhost:3000';
          const host = req.headers.get('host') || 'localhost:3000';
          const protocol = origin.startsWith('https') ? 'https' : 'http';
          const baseUrl = `${protocol}://${host}`;
          
          console.log(`📤 Sending message:`, questionText.substring(0, 100));
          
          const chatResponse = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: uiMessages
            })
          });

          if (!chatResponse.ok) {
            const errorText = await chatResponse.text();
            console.error(`❌ Chat API error (${chatResponse.status}):`, errorText);
            throw new Error(`Chat API returned ${chatResponse.status}`);
          }

          console.log(`✅ Got response stream for question ${questionId}`);

          // Parse le stream de réponse
          const reader = chatResponse.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let fullResponse = '';
          let buffer = '';
          let chunkCount = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunkCount++;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              
              // Tous les formats possibles du stream
              if (line.startsWith('0:')) {
                try {
                  const jsonStr = line.substring(2);
                  const parsed = JSON.parse(jsonStr);
                  
                  if (typeof parsed === 'string') {
                    fullResponse += parsed;
                  } else if (parsed && typeof parsed === 'object') {
                    if ('text' in parsed) fullResponse += parsed.text;
                    if ('content' in parsed) fullResponse += parsed.content;
                  }
                } catch (e) {
                  // Essaie de traiter comme texte brut
                  fullResponse += line.substring(2);
                }
              }
            }
          }

          console.log(`📦 Received ${chunkCount} chunks, total length: ${fullResponse.length}`);

          const finalResponse = fullResponse.trim() || "Aucune réponse générée.";
          reponses[categorieId][questionId] = finalResponse;
          
          console.log(`✅ Question ${questionId} completed`);
          console.log(`📝 Response: ${finalResponse.substring(0, 200)}...`);
          
        } catch (error) {
          console.error(`❌ Error processing question ${categorieId}/${questionId}:`, error);
          reponses[categorieId][questionId] = "Erreur lors de la génération de la réponse.";
        }
      }
    }

    const output = {
      equipe: equipe,
      reponses: reponses
    };

    console.log('\n✅ All questions processed successfully');
    console.log('📊 Total responses:', Object.keys(reponses).length);
    
    return NextResponse.json(output);

  } catch (error) {
    console.error('❌ Error in evaluation route:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue lors du traitement des questions.' },
      { status: 500 }
    );
  }
}
