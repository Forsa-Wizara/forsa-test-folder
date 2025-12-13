interface DocumentListProps {
    documents: string[];
    partnerName?: string;
    notes?: string;
}

export function DocumentList({ documents, partnerName, notes }: DocumentListProps) {
    return (
        <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-950/30 dark:bg-amber-950/30 light:bg-amber-100/30 mb-3">
            <h4 className="font-bold text-amber-100 dark:text-amber-100 light:text-amber-900 mb-3 flex items-center gap-2">
                📄 Documents requis
                {partnerName && <span className="text-sm font-normal text-muted-foreground">({partnerName})</span>}
            </h4>
            <ul className="space-y-2">
                {documents.map((doc, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-amber-400 dark:text-amber-400 light:text-amber-600 mt-1">✓</span>
                        <span>{doc}</span>
                    </li>
                ))}
            </ul>
            {notes && (
                <p className="text-xs text-amber-300 dark:text-amber-300 light:text-amber-700 mt-3 pt-3 border-t border-amber-500/20 italic">
                    ℹ️ {notes}
                </p>
            )}
        </div>
    );
}
