// Exact messages the UI buttons send. The server recognises them and answers without calling the AI.
// (Browser-safe: no server imports.)
export const CHECKOUT_TEXT = "I'd like to place my order";
export const CONFIRM_TEXT = "Yes, place the order";
export const addRequestText = (name: string, qty = 1) => `Add ${qty} ${name} to my cart`;
