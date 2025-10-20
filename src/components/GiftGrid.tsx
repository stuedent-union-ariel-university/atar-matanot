"use client"; // This ensures the component is only rendered on the client side

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { config } from "@/lib/config";
import type { Gift } from "@/lib/gifts";

export default function GiftGrid() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const userIdFromParams = searchParams.get("userId");
    if (userIdFromParams && userIdFromParams !== userId) {
      setUserId(userIdFromParams);
    }
  }, [searchParams, userId]);

  useEffect(() => {
    if (!userId) return;

    const checkEligibility = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${config.API_CHECK_GIFT_URL}?userId=${userId}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "אירעה שגיאה");
        }

        setIsEligible(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה שגיאה");
        setIsEligible(false);
      } finally {
        setLoading(false);
      }
    };

    checkEligibility();
  }, [userId]);

  // Load gift options (independent of eligibility so user sees something quickly; could gate if desired)
  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const res = await fetch(config.API_GIFTS_URL, { cache: "no-store" });
        if (!res.ok) return; // silent fail
        const data = await res.json();
        setGifts(data.gifts || []);
      } catch {
        // ignore for now
      }
    };
    fetchGifts();
  }, []);

  const handleSubmit = async () => {
    if (!userId || !selectedGiftId) {
      setError("יש לבחור מתנה תחילה");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(config.API_SUBMIT_GIFT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, giftId: selectedGiftId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "אירעה שגיאה בשמירת הבחירה");
      }

      setError(null);

      // Redirect to thank you page with gift title (encode to be safe in URL)
      const chosenGift = gifts.find((g) => g.id === selectedGiftId);
      const giftTitle = chosenGift ? encodeURIComponent(chosenGift.title) : "";
      router.push(`/thank-you?gift=${giftTitle}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "אירעה שגיאה בשמירת הבחירה"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto flex items-center justify-center min-h-[200px]">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error text-rose-800 mb-6">
        <span className="font-semibold text-rose-700">שגיאה:</span> {error}
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="alert alert-error text-rose-800 mb-6">
        מספר זהות לא נמצא בקישור
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto text-center" dir="rtl">
      {isEligible && (
        <div className="alert alert-success text-emerald-800 mb-8">
          <span className="font-semibold text-emerald-700">מזל טוב!</span> אתה
          זכאי לבחור מתנה. לאחר השליחה לא ניתן לשנות בחירה.
        </div>
      )}
      {isEligible && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gifts.map((gift) => {
              const selected = gift.id === selectedGiftId;
              const remaining = gift.remaining ?? gift.stock ?? 0;
              const isOut = remaining <= 0;
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => !isOut && setSelectedGiftId(gift.id)}
                  aria-pressed={selected}
                  aria-disabled={isOut}
                  className={`relative group rounded-2xl border p-4 text-right transition shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7FC4]/40 ${
                    isOut
                      ? "border-rose-300 bg-rose-50/70 cursor-not-allowed opacity-70"
                      : selected
                      ? "border-[#3B7FC4]/50 bg-[#3B7FC4]/10"
                      : "border-black/10 bg-white/60"
                  }`}
                  dir="rtl"
                >
                  {selected && !isOut && (
                    <span className="absolute -top-2 -left-2 bg-[#3B7FC4] text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                      נבחר
                    </span>
                  )}
                  {isOut && (
                    <span className="absolute -top-2 -left-2 bg-rose-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                      נגמר המלאי
                    </span>
                  )}
                  {gift.image && (
                    <div className="w-full h-44 relative mb-4 rounded-lg overflow-hidden">
                      <Image
                        src={gift.image}
                        alt={gift.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className={`object-cover opacity-95 group-hover:opacity-100 transition-transform duration-300 group-hover:scale-[1.02] ${
                          isOut ? "grayscale" : ""
                        }`}
                        priority={false}
                      />
                    </div>
                  )}
                  <h3 className="font-semibold text-lg mb-1 tracking-tight">
                    {gift.title}
                  </h3>
                  {gift.description && (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {gift.description}
                    </p>
                  )}
                  {/* stock indicators */}
                  <div className="mt-2 text-sm">
                    {isOut && (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                        ❌ אזל מהמלאי
                      </span>
                    )}
                  </div>
                  {/* subtle primary glow on hover */}
                  <span
                    className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      boxShadow:
                        "inset 0 0 0 1px rgba(59,127,196,0.12), 0 10px 22px -12px rgba(59,127,196,0.35)",
                    }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            {gifts.length === 0 && (
              <div className="col-span-full text-slate-500 text-sm">
                לא נמצאו מתנות כרגע.
              </div>
            )}
          </div>
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedGiftId}
              className="btn-futuristic min-w-40 disabled:opacity-40"
            >
              <span className="relative flex items-center justify-center gap-2">
                {submitting && (
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                )}
                {submitting
                  ? "שולח..."
                  : selectedGiftId
                  ? "שלח בחירה"
                  : "בחר מתנה"}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
