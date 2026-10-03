import { lesson as useState } from "./react-hooks/01-use-state";
import { lesson as useEffect } from "./react-hooks/02-use-effect";
import { lesson as useRef } from "./react-hooks/03-use-ref";
import { lesson as useReducer } from "./react-hooks/04-use-reducer";
import { lesson as useContext } from "./react-hooks/05-use-context";

export type Lesson = {
  title: string;
  instructions: string;
  starter: string;
  solution: string;
  tests: string;
};

/** Lesson id (used in `?lesson=<id>`) → Lesson. */
export const lessons: Record<string, Lesson> = {
  "react-hooks/01-use-state": useState,
  "react-hooks/02-use-effect": useEffect,
  "react-hooks/03-use-ref": useRef,
  "react-hooks/04-use-reducer": useReducer,
  "react-hooks/05-use-context": useContext,
};
