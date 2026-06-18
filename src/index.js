// @start-today/platform-shared
//
// Root package — re-exports each sub-module. For tree-shaking, prefer the
// subpath imports (e.g. '@start-today/platform-shared/orgmap') instead of
// pulling everything from the root.

export * from './orgmap/index.js'
