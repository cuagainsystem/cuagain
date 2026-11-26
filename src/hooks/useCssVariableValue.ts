import { useMemo } from 'react';

/**
 * Reads the current value of a CSS variable from :root.
 * Used by the design-system page so the documented values can never drift from tokens.css.
 * The stylesheet is loaded before React renders, so the value is available immediately.
 */
export function useCssVariableValue(variableName: string): string {
  return useMemo(
    () => getComputedStyle(document.documentElement).getPropertyValue(variableName).trim(),
    [variableName],
  );
}
