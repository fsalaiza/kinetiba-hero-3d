import { createContext, useContext } from "react";

const HeroContext = createContext(null);

export function useHeroContext() {
  const ctx = useContext(HeroContext);
  if (!ctx) throw new Error("KinetibaHero sub-components must be used within <KinetibaHero.Root>");
  return ctx;
}

export default HeroContext;
