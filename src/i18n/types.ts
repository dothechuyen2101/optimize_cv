import type vi from "./dictionaries/vi.json";

// Kept apart from get-dictionary.ts so Client Components can import the type.
export type Dictionary = typeof vi;
