import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from './useDebouncedCallback';

/*
  A text box whose value lives in the address bar, but which is only written there after the
  user pauses typing.

  The tricky part is changes that come from somewhere else: the "Clear all filters" button, the
  browser's Back button, or a link. Those must update the box AND stop any search that was
  still waiting to be sent, otherwise an old search could come back a moment later. Every
  waiting search remembers the "generation" it was typed in, and is dropped if an outside
  change has started a new generation since.
*/
export function useUrlBackedText(urlValue: string, onCommit: (value: string) => void, delay = 350) {
  const [text, setText] = useState(urlValue);
  const [seenUrlValue, setSeenUrlValue] = useState(urlValue);
  const [lastCommitted, setLastCommitted] = useState(urlValue);
  const [generation, setGeneration] = useState(0);

  const generationRef = useRef(generation);
  useEffect(() => {
    generationRef.current = generation;
  }, [generation]);

  const send = useDebouncedCallback((value: string, typedInGeneration: number) => {
    if (typedInGeneration !== generationRef.current) return;
    setLastCommitted(value);
    onCommit(value);
  }, delay);

  if (urlValue !== seenUrlValue) {
    setSeenUrlValue(urlValue);

    // If the address now holds something this box did not send, the change came from outside.
    if (urlValue !== lastCommitted) {
      setText(urlValue);
      setLastCommitted(urlValue);
      setGeneration((current) => current + 1);
    }
  }

  return {
    text,
    onChange(value: string) {
      setText(value);
      send(value, generation);
    },
  };
}
