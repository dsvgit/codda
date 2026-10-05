// The module "@codda/test" as Lesson Tests see it in the type check of
// `codda test` (cli/type-check.ts): the public API of the Test Harness
// (harness.ts). codda-test.check.ts makes `npm run typecheck` fail when the two
// drift apart. The browser's Type Checker does not get it: the student does not
// edit Lesson Tests.

/** Registers a test; it fails if it throws or its promise rejects. */
export declare function test(name: string, fn: () => void | Promise<void>): void;

export declare function expect(actual: unknown): {
  /** Same value (`Object.is`). */
  toBe(expected: unknown): void;
  /** Same structure: arrays and plain objects compared key by key. */
  toEqual(expected: unknown): void;
};
