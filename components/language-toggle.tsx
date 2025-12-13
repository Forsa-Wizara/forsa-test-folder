'use client';

import { useLanguage } from './providers/language-provider';
import { Button } from './ui/button';
import { Icons } from './ui/icons';

export function LanguageToggle() {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'fr' ? 'ar' : 'fr');
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleLanguage}
            aria-label="Toggle language"
            title={language === 'fr' ? 'Passer à l\'arabe' : 'التبديل إلى الفرنسية'}
        >
            <Icons.languages />
            <span className="ml-1 text-xs font-medium">
                {language === 'fr' ? 'FR' : 'AR'}
            </span>
        </Button>
    );
}
