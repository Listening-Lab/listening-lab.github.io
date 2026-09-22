import Script from 'next/script'

// Same value as NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (.env) — Firebase's web config
// already carries this GA4 stream id, no need for a second copy of the same constant.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

export default function GoogleAnalytics() {
  // Only in a real build (`next build`, incl. the static export CI deploys) — not `next
  // dev` — so local development browsing never pollutes production analytics.
  if (!GA_MEASUREMENT_ID || process.env.NODE_ENV !== 'production') return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  )
}
