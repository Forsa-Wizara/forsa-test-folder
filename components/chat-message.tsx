'use client';

import { Icons } from './ui/icons';

interface ChatMessageProps {
    role: 'user' | 'assistant' | 'system';
    children: React.ReactNode;
}

export function ChatMessage({ role, children }: ChatMessageProps) {
    const isUser = role === 'user';
    const isSystem = role === 'system';

    // Don't render system messages in the UI
    if (isSystem) {
        return null;
    }

    return (
        <div className={`group relative mb-4 flex items-start ${isUser ? '' : 'md:-ml-12'}`}>
            <div className="flex-shrink-0 flex flex-col relative items-end">
                <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow ${isUser
                        ? 'bg-background'
                        : 'bg-primary text-primary-foreground'
                    }`}>
                    {isUser ? (
                        <Icons.user />
                    ) : (
                        <Icons.bot />
                    )}
                </div>
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
                {children}
            </div>
        </div>
    );
}
