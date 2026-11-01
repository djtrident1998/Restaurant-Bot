// Server-side: recognise menu requests and build course listings (no model call).
import { searchMenu } from "./menu";
import { searchMenuTool } from "./tools";
import { COURSES, courseRequestText, type Course } from "./courseData";

export { COURSES, COURSE_ASK_MARKER, COURSE_ASK_TEXT, courseRequestText, type Course } from "./courseData";

const MENU_WORDS = /\b(menu|what (do you|can i|have you)( have| serve| offer)?|what's (on|available|good)|what is available|show me (the )?(food|dishes|everything)|what food|i('m| am) hungry|what are (the|your) (dishes|options)|options)\b/i;
// Anything specific (a course, a diet, a price, a dish) goes to the normal assistant instead.
const SPECIFIC =
  /\b(starters?|appetizers?|appetisers?|mains?|curry|curries|breads?|naan|roti|rice|biryani|desserts?|sweets?|drinks?|beverages?|tea|chai|lassi|veg|vegan|vegetarian|non-?veg|under|below|cheap|spicy|mild|allerg\w*|gluten|nuts?|dairy|prices?|costs?|how much|₹|rs|paneer|chicken|lamb|fish|dal|add|cart|checkout)\b/i;
// Unambiguous "what is there to eat" questions, even though they contain words like "order".
const GENERIC = /^(what (can|should|do) i (order|get|eat|have)|what (do|can) you (have|serve|offer|recommend)|what('s| is) (on|available|good)( tonight| today)?|i('m| am) hungry|show me (the )?(food|dishes|everything))\??\s*$/i;

export type MenuIntent = { type: "ask" } | { type: "course"; course: Course } | null;

export function detectMenuIntent(text: string): MenuIntent {
  const t = text.trim();
  // 1. A course button press ("Show me the starters").
  for (const c of COURSES) if (t.toLowerCase() === courseRequestText(c).toLowerCase()) return { type: "course", course: c };
  // 2. "show me the menu" / "what do you have" with nothing more specific -> ask which course.
  if (t.length <= 80 && (GENERIC.test(t) || (MENU_WORDS.test(t) && !SPECIFIC.test(t)))) return { type: "ask" };
  return null;
}

/** One search_menu-shaped output per category, built straight from the menu (no model call). */
export function courseOutputs(course: Course) {
  return course.categories.map((category) => ({
    category,
    toolName: "search_menu",
    input: { query: "", filters: { category } },
    output: searchMenuTool({ query: "", filters: { category } }),
  }));
}

export function courseItemCount(course: Course): number {
  return course.categories.reduce((n, c) => n + searchMenu("", { category: c }).length, 0);
}
