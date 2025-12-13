'use client';

import { useTheme } from './providers/theme-provider';
import { Button } from './ui/button';
import { Icons } from './ui/icons';

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'light' ? 'Passer au mode sombre' : 'Passer au mode clair'}
        >
            {theme === 'light' ? <Icons.moon /> : <Icons.sun />}
        </Button>
    );
}
