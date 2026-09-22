import { Metadata } from "next";
import Link from "next/link";
import AcousticMapDemo from "@/components/AcousticMapDemo";

export const metadata: Metadata = {
  title: "Acoustic Map & Species Explorer Demo | Listening Lab",
  description:
    "Interactive acoustic map and 3D embedding space with integrated bird species photographs and biological profiles.",
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-ocean-dark text-white">
      {/* Top Bar navigation */}
      <div className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between z-30 relative">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-[#4ecdc4] hover:underline bg-white/5 border border-white/10 px-4 py-2 rounded-full transition-colors"
        >
          <span>← Back to Home</span>
        </Link>
        <span className="text-xs tracking-widest uppercase text-white/40 font-mono">
          Listening Lab Demo
        </span>
      </div>

      {/* Main Interactive Demo Component */}
      <AcousticMapDemo />
    </div>
  );
}
