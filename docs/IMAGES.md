# Photography

All photos are hosted by **Unsplash** and used under the [Unsplash License](https://unsplash.com/license) (free to use, no attribution required — credit is given in the site footer anyway).

- Menu items store only a photo id (`image` in `lib/menu.json`); `lib/images.ts` builds the CDN URL and requests the size needed.
- Landing-page photography (hero dining room, copper curry bowl, feast banner, tandoor) is defined in `lib/images.ts`.
- Every URL was checked to load, and every photo was viewed on a contact sheet before use.

## Matching is by dish *family*, not exact dish
Unsplash does not have a photo of every one of our 42 dishes. Photos were matched to the closest family (kebabs, creamy curries, dal, breads, biryani, sweets, drinks), and a few dishes share a photo (for example both naans, both plain rice dishes). The footer says photography is illustrative. If you have your own dish photos, replace the `image` ids in `lib/menu.json` with your own hosted image URLs (and adjust `photoUrl`).

## Changing a photo
1. Find the photo on unsplash.com and copy its image id (the part after `photo-` in the `images.unsplash.com` URL).
2. Put it in the dish's `image` field in `lib/menu.json`.
