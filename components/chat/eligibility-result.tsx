interface EligibilityResultProps {
    data: {
        eligible: boolean;
        reasons: string[];
        convention_name?: string;
    };
}

export function EligibilityResult({ data }: EligibilityResultProps) {
    return (
        <div className={`border rounded-lg p-4 mb-3 ${data.eligible
                ? 'border-green-500/30 bg-green-950/30 dark:bg-green-950/30 light:bg-green-100/30'
                : 'border-red-500/30 bg-red-950/30 dark:bg-red-950/30 light:bg-red-100/30'
            }`}>
            <div className="flex items-center gap-2 mb-2">
                <span className={`text-2xl ${data.eligible ? 'text-green-400 dark:text-green-400 light:text-green-600' : 'text-red-400 dark:text-red-400 light:text-red-600'}`}>
                    {data.eligible ? '✓' : '✗'}
                </span>
                <h4 className={`font-bold ${data.eligible ? 'text-green-100 dark:text-green-100 light:text-green-900' : 'text-red-100 dark:text-red-100 light:text-red-900'}`}>
                    {data.eligible ? 'Éligible' : 'Non éligible'}
                </h4>
                {data.convention_name && (
                    <span className="text-sm text-muted-foreground">• {data.convention_name}</span>
                )}
            </div>
            <ul className="space-y-1 ml-8">
                {data.reasons.map((reason, idx) => (
                    <li key={idx} className={`text-sm ${data.eligible ? 'text-green-300 dark:text-green-300 light:text-green-700' : 'text-red-300 dark:text-red-300 light:text-red-700'}`}>
                        {reason}
                    </li>
                ))}
            </ul>
        </div>
    );
}
