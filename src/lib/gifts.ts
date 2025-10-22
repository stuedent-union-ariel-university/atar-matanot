export type Gift = {
  id: string;
  title: string;
  description?: string;
  image?: string; // relative to /public
  // Optional note to show under the card (e.g., arrival info)
  disclaimer?: string;
  // Total initial stock for this gift (configured once).
  stock?: number;
  // Computed server-side: how many units remain (stock - claimed). Not stored persistently here.
  remaining?: number;
};

// For now this is static. In the future this could be fetched from Monday or a DB.
export const gifts: Gift[] = [
  {
    id: "eir-gps-tag",
    title: "אייר - תג GPS",
    image: "/air-tag.png",
    stock: 290, // Excel 10% off
  },
  {
    id: "thermal-cup",
    title: "כוס תרמית",
    image: "/כוס-תרמית.png",
    stock: 130, // 113 (Excel 10% off) + 1500 * 0.9
  },
  {
    id: "thermal-cup-with-straw",
    stock: 1200,
    title: "כוס תרמית עם קש",
    image: "/כוס-תרמית-עם-קש.png",
  },

  // New gift: Laptop work tray (arrives later this semester)
  {
    id: "laptop-work-tray",
    title: "מגש עבודה למחשב",
    image: "/מגש-עבודה-למחשב.png",
    stock: 450, // 0 (Excel) + 500 * 0.9
    disclaimer: "המוצר יגיע בהמשך הסמסטר. ניתן להגיע לקחת מהאגודה.",
  },
  {
    id: "laptop-stand",
    title: "מעמד למחשב נייד",
    image: "/מעמד-למחשב.png",
    stock: 383,
  },
  {
    id: "gray-cooler-6l",
    title: "צידנית יד אפורה 6 ל' דופן כפולה",
    image: "/צידנית-יד-6.png",
    stock: 150,
  },

  // Lunchboxes – both SKUs from the Excel:
  {
    id: "pp-lunchbox-with-cutlery",
    title: "קופסאות אוכל",
    description: "עם סכום",
    image: "/קופסת-אוכל.png",
    stock: 300, // Excel 10% off (291.6 -> 292)
  },
  {
    id: "white-lunchbox-with-cutlery",
    title: "קופסת אוכל לבנה עם סכום",
    image: "/קופסת-אוכל-לבנה.png",
    stock: 1000, // Excel 10% off
  },

  {
    id: "medium-training-bag-bw-28l",
    title: "תיק אימון בינוני שחור לבן 28 ל'",
    image: "/תיק-אימון-שחור.png",
    stock: 70, // Excel 10% off
  },
  {
    id: "large-training-bag-gray-shoes-32l",
    title: "תיק אימון גדול אפור עם תא לנעליים 32 ל'",
    image: "/תיק-אימון-אפור.png",
    stock: 90, // Excel 10% off
  },
  {
    id: "gray-backpack",
    title: "תיק גב אפור",
    image: "/תיק-גב-אפור.png",
    stock: 270, // Excel 10% off
  },
  {
    id: "blue-backpack",
    title: "תיק גב כחול",
    image: "/תיק-גב-כחול.png",
    stock: 380, // Excel 10% off
  },
  {
    id: "black-backpack",
    title: "תיק גב שחור",
    image: "/תיק-גב-שחור.png",
    stock: 180, // Excel 10% off
  },
  {
    id: "gray-cooler-8l",
    title: "צידנית יד אפורה 8 ל'",
    image: "/צידנית-יד-8.png",
    stock: 1200,
  },

  // New gift: Sports bag (arrives later this semester)
  {
    id: "sports-bag",
    title: "תיק ספורט",
    image: "/תיק-ספורט.png",
    stock: 1350, // 0 (Excel) + 1500 * 0.9
    disclaimer: "המוצר יגיע בהמשך הסמסטר. ניתן להגיע לקחת מהאגודה.",
  },
  {
    id: "mat",
    title: "מחצלת",
    image: "/מחצלת.png",
    stock: 50, // Excel 10% off
  },
];
