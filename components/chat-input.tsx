'use client';

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Icons } from './ui/icons';

interface ChatInputProps {
    onSubmit: (message: string) => void;
    isLoading: boolean;
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSubmit(input);
            setInput('');
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleMicClick = () => {
        // TODO: Implement speech-to-text functionality
        console.log('Microphone clicked - Speech-to-text to be implemented');
    };

    return (
        <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <form onSubmit={handleSubmit} className="p-4 max-w-4xl mx-auto">
                <div className="relative flex items-end gap-2">
                    <div className="flex-1 relative">
                        <Textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.currentTarget.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Posez votre question sur les conventions..."
                            disabled={isLoading}
                            rows={1}
                            className="min-h-[60px] max-h-[200px] pr-12 resize-none"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleMicClick}
                            disabled={isLoading}
                            className="absolute right-2 bottom-2"
                            title="Dictée vocale (à venir)"
                        >
                            <Icons.mic />
                        </Button>
                    </div>
                    <Button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        size="icon"
                        className="h-[60px] w-[60px] shrink-0"
                    >
                        {isLoading ? <Icons.spinner /> : <Icons.send />}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    Appuyez sur Entrée pour envoyer, Shift+Entrée pour une nouvelle ligne
                </p>
            </form>
        </div>
    );
}
