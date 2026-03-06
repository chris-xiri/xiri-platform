import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'XIRI Facility Solutions — One Partner. Zero Headaches.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Fetch the actual font binary from the Google Fonts CSS API
async function loadGoogleFont(font: string, weight: number): Promise<ArrayBuffer> {
    const API = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&display=swap`;
    const css = await fetch(API, {
        headers: {
            // Request woff format — Satori needs raw font data
            'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
        },
    }).then((res) => res.text());

    // Extract the font URL from the CSS
    const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype|woff2?)'\)/);
    if (!match || !match[1]) {
        throw new Error(`Could not extract font URL from CSS for ${font} ${weight}`);
    }

    return fetch(match[1]).then((res) => res.arrayBuffer());
}

export default async function Image() {
    const [interBold, interRegular] = await Promise.all([
        loadGoogleFont('Inter', 800),
        loadGoogleFont('Inter', 400),
    ]);

    return new ImageResponse(
        (
            <div
                style={{
                    // Brand gradient: three-stop (BRAND_KIT.md)
                    background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #0284c7 100%)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Inter',
                    position: 'relative',
                }}
            >
                {/* Subtle accent glow (brand pattern) */}
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '600px',
                        height: '400px',
                        borderRadius: '50%',
                        background: 'radial-gradient(ellipse, rgba(56,189,248,0.12) 0%, transparent 70%)',
                    }}
                />

                {/* Wordmark: Inter 800, tight tracking (BRAND_KIT.md) */}
                <div
                    style={{
                        fontSize: 84,
                        fontWeight: 800,
                        color: 'white',
                        letterSpacing: '-2px',
                        marginBottom: '6px',
                    }}
                >
                    XIRI
                </div>

                {/* Tagline: uppercase, wide tracking (BRAND_KIT.md) */}
                <div
                    style={{
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'rgba(255,255,255,0.65)',
                        letterSpacing: '5px',
                        textTransform: 'uppercase' as const,
                        marginBottom: '40px',
                    }}
                >
                    FACILITY SOLUTIONS
                </div>

                {/* Accent divider using brand accent #38bdf8 */}
                <div
                    style={{
                        width: '100px',
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
                        marginBottom: '36px',
                    }}
                />

                {/* Value prop */}
                <div
                    style={{
                        fontSize: 26,
                        fontWeight: 400,
                        color: 'rgba(255,255,255,0.85)',
                        letterSpacing: '0.5px',
                    }}
                >
                    One Partner. Zero Headaches. Nightly Verified.
                </div>
            </div>
        ),
        {
            ...size,
            fonts: [
                {
                    name: 'Inter',
                    data: interBold,
                    style: 'normal',
                    weight: 800,
                },
                {
                    name: 'Inter',
                    data: interRegular,
                    style: 'normal',
                    weight: 400,
                },
            ],
        }
    );
}
