export type Gift = {
    id: string;
    title: string;
    description?: string;
    image?: string; // relative to /public
    stock?: number;
    remaining?: number;
};

// Updated from טבלת מלאי מאוחדת.xlsx
export const gifts: Gift[] = [
    {
        id: "white-thermal-cup-with-straw",
        title: "כוס תרמוס עם קש",
        description: 'לבן 900 מ"ל',
        image: "/gifts/white-thermal-cup-with-straw.png",
        stock: 110,
    },
    {
        id: "white-thermal-cup-with-straw-new",
        title: "כוס תרמוס עם קש",
        description: "לבן 700 מל",
        image: "/gifts/white-thermal-cup-with-straw.png",
        stock: 1000,
    },
    {
        id: "black-thermal-cup-with-straw",
        title: "כוס תרמוס עם קש",
        description: "שחור",
        image: "/gifts/black-thermal-cup-with-straw.png",
        stock: 280,
    },
    {
        id: "regular-laptop-tablet-tray",
        title: "מגש פינוק למחשב נייד / טאבלט",
        description: "רגיל",
        image: "/gifts/regular-laptop-tablet-tray.png",
        stock: 185,
    },
    {
        id: "laptop-stand",
        title: "מעמד מחשב",
        image: "/gifts/laptop-stand.png",
        stock: 260,
    },
    {
        id: "gray-cooler-8l",
        title: "צידנית 8 ליטר",
        description: "אפור",
        image: "/gifts/gray-cooler-8l.png",
        stock: 470,
    },
    {
        id: "gray-lunch-cooler",
        title: "צידנית אישית",
        description: "אפור",
        image: "/gifts/gray-lunch-cooler.png",
        stock: 250,
    },
    {
        id: "blue-lunch-cooler",
        title: "צידנית אישית",
        description: "כחול",
        image: "/gifts/blue-lunch-cooler.png",
        stock: 250,
    },
    {
        id: "cream-lunch-cooler",
        title: "צידנית אישית",
        description: "לבן",
        image: "/gifts/cream-lunch-cooler.png",
        stock: 250,
    },
    {
        id: "black-lunch-cooler",
        title: "צידנית אישית",
        description: "שחור",
        image: "/gifts/black-lunch-cooler.png",
        stock: 250,
    },
    {
        id: "white-silicone-lunchboxes-set",
        title: "קופסאות אוכל",
        description: "סיליקון 2 תאים + עגולה שתי קומות | לבן",
        image: "/gifts/white-silicone-lunchboxes-set.png",
        stock: 905,
    },
    {
        id: "blue-silicone-lunchbox-cutlery",
        title: "קופסת אוכל סגירת סיליקון",
        description: "2 תאים + סכין ומזלג | כחול",
        image: "/gifts/blue-silicone-lunchbox-cutlery.png",
        stock: 168,
    },
    {
        id: "blue-quality-laptop-backpack",
        title: "תיק גב איכותי למחשב",
        description: "כחול",
        image: "/gifts/blue-quality-laptop-backpack.png",
        stock: 0,
    },
    {
        id: "black-quality-laptop-backpack",
        title: "תיק גב איכותי למחשב",
        description: "שחור",
        image: "/gifts/black-quality-laptop-backpack.png",
        stock: 0,
    },
    {
        id: "quality-laptop-backpack", // OSK263
        title: "תיק גב איכותי למחשב אפור",
        description: "אפור",
        image: "/gifts/gray-backpack.jpeg",
        stock: 0,
    },
    {
        id: "blue-premium-laptop-backpack",
        title: "תיק גב מפואר למחשב",
        description: "כחול",
        image: "/gifts/blue-premium-laptop-backpack.png",
        stock: 40,
    },
    {
        id: "black-premium-laptop-backpack",
        title: "תיק גב מפואר למחשב",
        description: "שחור",
        image: "/gifts/black-premium-laptop-backpack.png",
        stock: 40,
    },
    {
        id: "laptop-bag",
        title: "תיק למחשב",
        description: "רגיל",
        image: "/gifts/laptop-bag.png",
        stock: 50,
    },
    {
        id: "recycled-polo-line-laptop-bag",
        title: "תיק למחשב פולו ליין",
        description: "מחומר ממוחזר",
        image: "/gifts/recycled-polo-line-laptop-bag.png",
        stock: 20,
    },
    {
        id: "laptop-bag-osp4583f", // Osp4583F
        title: "תיק מחשב נייד",
        image: "/gifts/laptop-bag-osp4583f.jpg",
        stock: 850,
    },
    {
        id: "gray-polo-sports-bag",
        title: "תיק ספורט פולו",
        description: "אפור",
        image: "/gifts/gray-sportsbag.jpeg",
        stock: 525,
    },
    {
        id: "blue-polo-sports-bag",
        title: "תיק ספורט פולו",
        description: "כחול",
        image: "/gifts/blue-polo-sports-bag.png",
        stock: 425,
    },
    {
        id: "black-polo-sports-bag",
        title: "תיק ספורט פולו",
        description: "שחור",
        image: "/gifts/black-polo-sports-bag.jpeg",
        stock: 450,
    },
];
