'use client';

import { ThemeToggle } from './theme-toggle';
import Image from 'next/image';

export function ChatHeader() {
    return (
        <header className="sticky top-0 z-50 flex h-16 w-full shrink-0 items-center justify-between border-b bg-gradient-to-b from-background/10 via-background/50 to-background/80 px-4 backdrop-blur-xl">
            <div className="flex items-center">
                <div className="flex items-center gap-3">
                    <Image
                        src="/Algerie_Telecom.svg.png"
                        alt="Algérie Télécom"
                        width={40}
                        height={40}
                        className="object-contain"
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold">Assistant Conventions</span>
                        <span className="text-xs text-muted-foreground">Algérie Télécom</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-end space-x-2">
                <ThemeToggle />
            </div>
        </header>
    );
}
