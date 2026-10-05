import { createContext, useContext } from "react";

export const ThemeContext = createContext("light");

export function ThemedButton() {
  return <button className="light">Theme: light</button>;
}
