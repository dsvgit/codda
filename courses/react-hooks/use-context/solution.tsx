import { createContext, useContext } from "react";

export const ThemeContext = createContext("light");

export function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Theme: {theme}</button>;
}
