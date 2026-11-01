// Browser-safe course constants (no server imports) — used by the chat UI and by lib/course.ts.
import type { Category } from "./menu";

export interface Course {
  key: string;
  label: string;
  intro: string;
  categories: Category[];
}

// A restaurant asks what you'd like to begin with instead of dumping a 40-item menu.
export const COURSES: Course[] = [
  { key: "starters", label: "Starters", intro: "Our starters, fresh from the tandoor.", categories: ["Starters"] },
  { key: "mains", label: "Main Course", intro: "Our main courses — vegetarian and non-vegetarian.", categories: ["Veg Mains", "Non-Veg Mains"] },
  { key: "breads-rice", label: "Breads & Rice", intro: "Breads from the tandoor and our rice dishes.", categories: ["Breads", "Rice & Biryani"] },
  { key: "desserts", label: "Desserts", intro: "To end the evening on something sweet.", categories: ["Desserts"] },
  { key: "drinks", label: "Drinks", intro: "Refreshing drinks to go with your meal.", categories: ["Beverages"] },
];

// The UI shows the course buttons when the last waiter message contains this marker.
export const COURSE_ASK_MARKER = "What would you like to begin with?";
export const COURSE_ASK_TEXT = `Welcome to Spice Route. ${COURSE_ASK_MARKER} Choose a course below and I'll show you what we're serving tonight.`;

/** The exact message the course buttons send; also what the server recognises as an explicit course request. */
export const courseRequestText = (c: Course) => `Show me the ${c.label.toLowerCase()}`;
