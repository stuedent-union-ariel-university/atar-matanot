// src/app/page.tsx

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamically import GiftGrid with ssr: false
const GiftGrid = dynamic(() => import("@/components/GiftGrid"));

export default function Home() {
  return (
    <div className="font-sans min-h-screen px-5 md:px-10 pb-20 pt-10">
      <main className="max-w-6xl mx-auto">
        <section className="text-center mb-12 md:mb-16 relative">
          <div className="mx-auto max-w-3xl">
            <h1 className="fancy-underline neon-text text-4xl md:text-5xl font-bold mb-5 leading-tight">
              בחרו את המתנה שלכם
            </h1>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-600 leading-relaxed">
              לחצו על המתנה שברצונכם לבחור. כל מתנה ניתנת לבחירה פעם אחת בלבד.
              אנחנו משתמשים באימות כדי להבטיח הוגנות ושקיפות.
            </p>
          </div>

          {/* soft gradient halo */}
          <div
            className="pointer-events-none absolute -inset-x-10 -bottom-6 top-1/2 bg-gradient-to-b from-transparent via-[#3B7FC4]/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
        </section>

        <div className="relative">
          <div
            className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-[#3B7FC4]/20 via-transparent to-[#3B7FC4]/5 blur-2xl pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative glass glass-border p-6 md:p-10">
            <Suspense
              fallback={
                <div className="flex justify-center py-14">
                  <div className="spinner" />
                </div>
              }
            >
              <GiftGrid />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
