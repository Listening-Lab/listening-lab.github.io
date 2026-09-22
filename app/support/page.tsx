import { redirect } from "next/navigation";
import AnimatedSection from "@/components/AnimatedSection";

const TEAL = "#4ecdc4";

const DONATE_URL = process.env.NEXT_PUBLIC_STRIPE_DONATE_URL;

// Hidden pre-launch — no business number yet, so no live Stripe link. Kept here (unused)
// for a fast re-enable: once a real donate link and subscription pricing exist, delete
// the redirect() below, make this the default export again, and restore the nav/footer
// links to /support.
function SupportContent() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <AnimatedSection>
          <p
            className="text-xs tracking-widest uppercase mb-4 font-medium"
            style={{ color: TEAL }}
          >
            Our vision
          </p>
          <h1 className="font-serif text-5xl text-white mb-6">
            Support the Listening Lab
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed mb-4">
            Listening Lab (Nature Commons Ltd) is a not-for-profit platform.
            Every dollar that comes in goes back into the platform, the research
            it enables, and supports the wider conservation community.
          </p>
          <p className="text-gray-400 leading-relaxed mb-16">
            Viewing and labeling the shared Public dataset is, and always will
            be, free — that's how the models everyone uses get better. The
            options below are how you can help fund the parts that cost real
            money: storage, compute, and the researchers and conservation groups
            doing the work.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="bg-white/5 border border-white/15 rounded-2xl p-6 md:p-8 mb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-serif text-2xl text-white">Donate</h2>
              <span
                className="text-xs font-medium px-3 py-1 rounded-full border"
                style={{
                  color: TEAL,
                  borderColor: `${TEAL}55`,
                  backgroundColor: `${TEAL}1a`,
                }}
              >
                Open now
              </span>
            </div>
            <p className="text-gray-300 leading-relaxed mb-3">
              Donations fund compute for training public-good species models,
              keep the Public dataset free to use, and support the conservation
              groups and researchers we work with.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Nature Commons Ltd isn't a registered charity yet, so donations
              aren't tax-deductible. That'll change once charitable registration
              is in place — this page will be updated then.
            </p>
            {DONATE_URL ? (
              <a
                href={DONATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white text-ocean-dark px-8 py-3 rounded-full font-medium hover:bg-brand-50 transition-colors"
              >
                Donate
              </a>
            ) : (
              <div>
                <button
                  disabled
                  className="bg-white/10 text-gray-400 px-8 py-3 rounded-full font-medium cursor-not-allowed"
                >
                  Donate
                </button>
                <p className="text-gray-600 text-xs mt-2">
                  Donations are opening shortly.
                </p>
              </div>
            )}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-serif text-2xl text-gray-300">Subscribe</h2>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-gray-400 border border-white/15">
                Coming soon
              </span>
            </div>
            <p className="text-gray-400 leading-relaxed mb-3">
              Subscriptions unlock your own private projects — uploading and
              storing recordings, training your own species models. A small
              base fee covers platform upkeep; storage and compute are priced
              close to what they actually cost us, not marked up.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Still finalizing exact pricing — you'll see it here first.
            </p>
            <button
              disabled
              className="bg-white/10 text-gray-500 px-8 py-3 rounded-full font-medium cursor-not-allowed"
            >
              Subscribe
            </button>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}

export default function SupportPage() {
  redirect("/");
}
