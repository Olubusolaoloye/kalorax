import { useEffect, useState } from "react";

/** The value, but only after it has stopped changing for `ms` — so a search asks the server once you pause typing, not on every key. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}
