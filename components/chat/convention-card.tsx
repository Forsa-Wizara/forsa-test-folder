interface ConventionCardProps {
    data: {
        convention_id: string;
        partner_name: string;
        aliases?: string[];
        client_type?: string;
        eligibility?: any;
        offers_count?: number;
    };
}

export function ConventionCard({ data }: ConventionCardProps) {
    return (
        <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-950/30 dark:bg-blue-950/30 light:bg-blue-100/30 mb-3">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h3 className="font-bold text-blue-100 dark:text-blue-100 light:text-blue-900 text-lg">{data.partner_name}</h3>
                    {data.aliases && data.aliases.length > 0 && (
                        <p className="text-xs text-muted-foreground">Alias: {data.aliases.join(', ')}</p>
                    )}
                </div>
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 dark:text-blue-300 light:text-blue-700">
                    {data.convention_id}
                </span>
            </div>

            {data.client_type && (
                <div className="mb-2">
                    <span className={`text-xs px-2 py-1 rounded ${data.client_type === 'B2C' ? 'bg-green-500/20 text-green-300 dark:text-green-300 light:text-green-700' : 'bg-purple-500/20 text-purple-300 dark:text-purple-300 light:text-purple-700'
                        }`}>
                        {data.client_type}
                    </span>
                </div>
            )}

            {data.eligibility && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {data.eligibility.active && (
                        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300 dark:text-green-300 light:text-green-700">
                            ✓ Actifs
                        </span>
                    )}
                    {data.eligibility.retired && (
                        <span className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-300 dark:text-orange-300 light:text-orange-700">
                            ✓ Retraités
                        </span>
                    )}
                    {data.eligibility.family && (
                        <span className="text-xs px-2 py-1 rounded bg-pink-500/20 text-pink-300 dark:text-pink-300 light:text-pink-700">
                            ✓ Famille
                        </span>
                    )}
                </div>
            )}

            {data.offers_count !== undefined && (
                <p className="text-sm text-muted-foreground mt-2">
                    {data.offers_count} offre{data.offers_count > 1 ? 's' : ''} disponible{data.offers_count > 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
}
