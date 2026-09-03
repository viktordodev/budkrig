/**
 * Public surface of the `listings` module for board reads.
 *
 * M1: this delegates straight to the repository. M2 inverts the dependency —
 * the module will declare a `ListingRepository` port and the repo will
 * implement it (see src/modules/README.md). The call sites won't change.
 */
export { getActiveBoard } from "@/server/db/repositories/listings";
export type { BoardListing } from "@/server/db/repositories/listings";
