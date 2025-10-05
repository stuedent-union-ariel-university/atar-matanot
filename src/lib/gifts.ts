export type Gift = {
  id: string;
  title: string;
  description?: string;
  image?: string; // relative to /public
  remaining?: number; // optional if we later track inventory
};

// For now this is static. In the future this could be fetched from Monday or a DB.
export const gifts: Gift[] = [
  {
    id: "eir-gps-tag",
    title: "אייר - תג GPS",
    image: "/air-tag.png",
    remaining: 383,
  },
  {
    id: "thermal-cup",
    title: "כוס תרמית",
    image: "/כוס-תרמית.png",
    remaining: 143,
  },
  {
    id: "laptop-stand",
    title: "מעמד למחשב נייד",
    image: "/מעמד-למחשב.png",
    remaining: 474,
  },
  {
    id: "gray-cooler-6l",
    title: "צידנית יד אפורה 6 ל' דופן כפולה",
    image: "/צידנית-יד-6.jpg",
    remaining: 190,
  },
  {
    id: "pp-lunchbox-with-cutlery",
    title: "קופסאות אוכל עם סכום חומר PP",
    image: "/קופסת-אוכל.png",
    remaining: 334,
  },
  {
    id: "white-lunchbox-with-cutlery",
    title: "קופסאת אוכל לבנה עם סכום",
    image: "/קופסת-אוכל-לבנה.png",
    remaining: 1469,
  },
  {
    id: "medium-training-bag-bw-28l",
    title: "תיק אימון בינוני שחור לבן 28 ל'",
    image: "/תיק-אימון-שחור.png",
    remaining: 105,
  },
  {
    id: "large-training-bag-gray-shoes-32l",
    title: "תיק אימון גדול אפור עם תא לנעליים 32 ל'",
    image: "/תיק-אימון-אפור.png",
    remaining: 121,
  },
  {
    id: "gray-backpack",
    title: "תיק גב אפור",
    image: "/תיק-גב-אפור.png",
    remaining: 301,
  },
  {
    id: "blue-backpack",
    title: "תיק גב כחול",
    image: "/תיק-גב-כחול.png",
    remaining: 430,
  },
  {
    id: "black-backpack",
    title: "תיק גב שחור",
    image: "/תיק-גב-שחור.png",
    remaining: 260,
  },
  {
    id: "fleece-blanket",
    title: "שמיכת פליז",
    image: "/gift-placeholder.jpg",
    remaining: 600,
  },
];
