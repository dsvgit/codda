// Type-level only, never bundled: the declaration of "@codda/test"
// (codda-test.d.ts) and the Test Harness must match both ways. A new matcher in
// one of them, or a changed signature, fails `npm run typecheck`.
import type * as Declared from "./codda-test";
import type * as Harness from "./harness";

type Public = Pick<typeof Harness, "test" | "expect">;

export const harnessIsDeclared = (harness: Public): typeof Declared => harness;
export const declaredIsHarness = (declared: typeof Declared): Public => declared;
