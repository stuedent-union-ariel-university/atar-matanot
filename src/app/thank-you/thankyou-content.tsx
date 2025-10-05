"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Confetti from "react-confetti";

export function ThankYouContent() {
  const searchParams = useSearchParams();
  const gift = searchParams.get("gift") || "המתנה";
  // simple fade-in effect without external dependency
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // trigger confetti slightly after mount for smoother animation
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative">
      {/* celebratory confetti */}
      {mounted && (
        <Confetti
          numberOfPieces={160}
          recycle={false}
          gravity={0.25}
          tweenDuration={6400}
        />
      )}
      <h1 className="fancy-underline neon-text text-4xl md:text-5xl font-bold mb-8 leading-tight">
        תודה שבחרת!
      </h1>
      <div
        className={`glass glass-border p-8 transition-opacity duration-700 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-xl md:text-2xl font-semibold mb-4">
          הבחירה שלך ב:{" "}
          <span className="text-[#3B7FC4]">{decodeURIComponent(gift)}</span>{" "}
          נשמרה בהצלחה.
        </p>
        <p className="text-slate-600 leading-relaxed max-w-prose mx-auto">
          המתנה תטופל ותימסר בהתאם להנחיות. אין צורך לבצע פעולה נוספת.
        </p>
      </div>
    </div>
  );
}
