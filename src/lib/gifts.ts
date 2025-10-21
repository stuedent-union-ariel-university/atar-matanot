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
    // new stock
    stock: 200,
  },
  {
    id: "thermal-cup",
    title: "כוס תרמית",
    image: "/כוס-תרמית.png",
    // new stock
    stock: 1500,
  },
  // New gift: Laptop work tray (arrives later this semester)
  {
    id: "laptop-work-tray",
    title: "מגש עבודה למחשב",
    image: "/gift-placeholder.jpg",
    stock: 500,
    disclaimer: "המוצר יגיע בהמשך הסמסטר. ניתן להגיע לקחת מהאגודה.",
  },
  {
    id: "laptop-stand",
    title: "מעמד למחשב נייד",
    image: "/מעמד-למחשב.png",
    // new stock
    stock: 350,
  },
  {
    id: "gray-cooler-6l",
    title: "צידנית יד אפורה 6 ל' דופן כפולה",
    image: "/צידנית-יד-6.png",
    // new stock
    stock: 1500,
  },
  {
    id: "pp-lunchbox-with-cutlery",
    title: "קופסאות אוכל",
    image: "/קופסת-אוכל.png",
    // new stock
    stock: 250,
  },

  {
    id: "medium-training-bag-bw-28l",
    title: "תיק אימון בינוני שחור לבן 28 ל'",
    image: "/תיק-אימון-שחור.png",
    // new stock
    stock: 50,
  },
  {
    id: "large-training-bag-gray-shoes-32l",
    title: "תיק אימון גדול אפור עם תא לנעליים 32 ל'",
    image: "/תיק-אימון-אפור.png",
    // new stock
    stock: 60,
  },
  {
    id: "gray-backpack",
    title: "תיק גב אפור",
    image: "/תיק-גב-אפור.png",
    // new stock
    stock: 200,
  },
  {
    id: "blue-backpack",
    title: "תיק גב כחול",
    image: "/תיק-גב-כחול.png",
    // new stock
    stock: 300,
  },
  {
    id: "black-backpack",
    title: "תיק גב שחור",
    image: "/תיק-גב-שחור.png",
    // new stock
    stock: 200,
  },
  // New gift: Sports bag (arrives later this semester)
  {
    id: "sports-bag",
    title: "תיק ספורט",
    image: "/תיק-ספורט.png",
    stock: 1500,
    disclaimer: "המוצר יגיע בהמשך הסמסטר. ניתן להגיע לקחת מהאגודה.",
  },
];
