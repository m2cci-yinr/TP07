/**
 * mapContext.js — provide / inject key
 *
 * provide / inject is Vue's solution for passing data deep into a component
 * tree without "prop drilling" (passing props through every intermediate layer).
 *
 * Pattern:
 *   • The root component (App.vue) calls provide(MAP_CONTEXT_KEY, { ... })
 *   • Any enfant can call inject(MAP_CONTEXT_KEY) to access that data directly
 *
 * We export a Symbol as the key. Using a Symbol (rather than a plain string)
 * prevents accidental key collisions between different provide/inject pairs.
 *
 * What we provide:
 *   filteredEvents  - the currently visible events (reactive)
 *   selectedLocation - the currently selected event (reactive)
 *   selectEvent     - function to programmatically select an event
 *   totalEvents     - total count (non-reactive, static)
 *   applyFilter
 *
 * This is used by WeatherPanel.vue (a grandchild of App) to read
 * selectedLocation without App needing to pass it as a prop chain.
 */

export const MAP_CONTEXT_KEY = Symbol('mapContext')
