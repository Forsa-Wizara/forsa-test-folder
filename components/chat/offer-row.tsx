interface OfferRowProps {
    offer: {
        category?: string;
        technology?: string;
        speed_mbps?: number;
        plan?: string;
        price_convention_da: number;
        price_public_da?: number;
        discount?: string;
        condition?: string;
        label?: string;
        note?: string;
    };
    partnerName?: string;
    conventionId?: string;
}

export function OfferRow({ offer, partnerName, conventionId }: OfferRowProps) {
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-DZ').format(price) + ' DA';
    };

    return (
        <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-950/30 dark:bg-emerald-950/30 light:bg-emerald-100/30 mb-3">
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 dark:text-emerald-300 light:text-emerald-700 font-medium">
                            {offer.category}
                        </span>
                        {offer.technology && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 dark:text-blue-300 light:text-blue-700">
                                {offer.technology}
                            </span>
                        )}
                        {offer.condition && (
                            <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300 dark:text-purple-300 light:text-purple-700">
                                {offer.condition}
                            </span>
                        )}
                    </div>

                    {offer.speed_mbps && (
                        <p className="text-sm text-foreground font-semibold">
                            {offer.speed_mbps} Mbps
                        </p>
                    )}

                    {offer.plan && (
                        <p className="text-sm text-foreground font-semibold">
                            {offer.plan}
                        </p>
                    )}

                    {offer.label && (
                        <p className="text-xs text-muted-foreground">{offer.label}</p>
                    )}
                </div>

                <div className="text-right">
                    <div className="text-lg font-bold text-emerald-300 dark:text-emerald-300 light:text-emerald-700">
                        {formatPrice(offer.price_convention_da)}
                    </div>

                    {offer.price_public_da && (
                        <div className="text-xs text-muted-foreground line-through">
                            {formatPrice(offer.price_public_da)}
                        </div>
                    )}

                    {offer.discount && (
                        <div className="text-xs text-emerald-400 dark:text-emerald-400 light:text-emerald-600 font-medium">
                            -{offer.discount}
                        </div>
                    )}
                </div>
            </div>

            {partnerName && (
                <p className="text-xs text-muted-foreground mt-2">
                    {partnerName} {conventionId && `(${conventionId})`}
                </p>
            )}

            {offer.note && (
                <p className="text-xs text-yellow-400 dark:text-yellow-400 light:text-yellow-600 mt-2 italic">
                    ℹ️ {offer.note}
                </p>
            )}
        </div>
    );
}
