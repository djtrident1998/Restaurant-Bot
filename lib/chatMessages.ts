// Exact messages the UI buttons send. The server recognises them and answers without calling the AI.
// (Browser-safe: no server imports.)
export const CHECKOUT_TEXT = "I'd like to place my order";
export const CONFIRM_TEXT = "Yes, place the order";
export const addRequestText = (name: string, qty = 1) => `Add ${qty} ${name} to my cart`;

// Guests can browse and fill a cart, but must sign in to order. The UI shows Sign in / Create account buttons
// when a waiter message contains this marker.
export const SIGN_IN_MARKER = "sign in or create an account";
export const SIGN_IN_TEXT = `Almost there. Please ${SIGN_IN_MARKER} to place your order — your cart will be kept while you do.`;
