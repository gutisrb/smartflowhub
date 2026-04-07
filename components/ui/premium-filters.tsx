/**
 * PremiumFilters — inject once in the layout root.
 * Provides globally referenceable SVG filter IDs:
 *   - #grain      → grainy noise texture
 *   - #soft-glow  → soft outer glow
 *   - #haze       → colour-shift blur
 */
export function PremiumFilters() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
            aria-hidden="true"
        >
            <defs>
                {/* ── Grain noise ── */}
                <filter id="grain" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.72"
                        numOctaves="4"
                        stitchTiles="stitch"
                        result="noise"
                    />
                    <feColorMatrix type="saturate" values="0" in="noise" result="greyNoise" />
                    <feBlend in="SourceGraphic" in2="greyNoise" mode="overlay" result="blend" />
                    <feComposite in="blend" in2="SourceGraphic" operator="in" />
                </filter>

                {/* ── Soft emerald glow ── */}
                <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur" />
                    <feFlood floodColor="#10b981" floodOpacity="0.5" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                {/* ── Cyan haze ── */}
                <filter id="haze" x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                    <feColorMatrix
                        type="matrix"
                        values="0 0 0 0 0.04
                                0 0 0 0 0.71
                                0 0 0 0 0.76
                                0 0 0 0.3 0"
                        in="blur"
                        result="color"
                    />
                    <feMerge>
                        <feMergeNode in="color" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
        </svg>
    )
}
