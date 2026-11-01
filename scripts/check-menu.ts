import { MENU, CATEGORIES, searchMenu, isVegan } from "../lib/menu";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

check("item count 38-45", MENU.length >= 38 && MENU.length <= 45, `(${MENU.length})`);
check("unique ids", new Set(MENU.map((i) => i.id)).size === MENU.length);
check("all categories valid", MENU.every((i) => (CATEGORIES as readonly string[]).includes(i.category)));
check("every category used", CATEGORIES.every((c) => MENU.some((i) => i.category === c)));
check("spice 0-3", MENU.every((i) => i.spice >= 0 && i.spice <= 3));

const names = (r: ReturnType<typeof searchMenu>) => r.map((i) => i.name);
check("paneer tikka found first", searchMenu("paneer tikka")[0]?.name === "Paneer Tikka");
check("sushi -> nothing", searchMenu("do you have sushi").length === 0);
const vegan300 = searchMenu("", { vegan: true, maxPrice: 300 });
check("vegan<=300 all vegan & cheap", vegan300.length > 3 && vegan300.every((i) => isVegan(i) && i.price <= 300), JSON.stringify(names(vegan300)));
check("veg:false are all non-veg", searchMenu("", { veg: false }).every((i) => !i.veg));
check("exclude nuts", searchMenu("", { excludeAllergen: "nuts" }).every((i) => !i.allergens.includes("nuts")));
check("maxSpice 0", searchMenu("", { maxSpice: 0 }).every((i) => i.spice === 0));
check("category Desserts", searchMenu("", { category: "Desserts" }).length === 4);
check("hottest = vindaloo", searchMenu("", { }).filter((i) => i.spice === 3).map((i) => i.name).join() === "Lamb Vindaloo");
check("price range wide", Math.max(...MENU.map((i) => i.price)) / Math.min(...MENU.map((i) => i.price)) > 10);

process.exit(fails ? 1 : 0);
