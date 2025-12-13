'use client';

import * as React from 'react';

type Language = 'fr' | 'ar';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = React.useState<Language>('fr');
    const [mounted, setMounted] = React.useState(false);

    // Load language from localStorage on mount
    React.useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            const savedLanguage = localStorage.getItem('language') as Language | null;
            if (savedLanguage) {
                setLanguageState(savedLanguage);
            }
        }
    }, []);

    // Save language to localStorage
    const setLanguage = React.useCallback((lang: Language) => {
        setLanguageState(lang);
        if (typeof window !== 'undefined') {
            localStorage.setItem('language', lang);
            // Update document direction for RTL support
            document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = lang;
        }
    }, []);

    // Apply direction on mount
    React.useEffect(() => {
        if (mounted && typeof window !== 'undefined') {
            document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = language;
        }
    }, [language, mounted]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = React.useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
