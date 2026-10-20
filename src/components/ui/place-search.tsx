"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadPlaces, type Place, type PlaceSuggestion } from "@/lib/maps";

const MIN_CHARS = 3;
const WAIT_MS = 250;

/**
 * An address search over Google Places, drawn with the app's own input and list so it matches the rest of the form
 * (the ready-made Google box cannot be themed). Typing offers matching places; picking one hands back the place with
 * its address, city and position loaded. If Google cannot be reached the box says so and the form's own fields still work.
 */
export function PlaceSearch({
  id,
  onPick,
  placeholder = "Search a place or address",
}: {
  id?: string;
  onPick: (place: Place) => void | Promise<void>;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const latest = useRef(0);
  const session = useRef<unknown>(undefined);

  // One search at a time, after the typing pauses; an answer that arrives after a newer one was asked for is dropped.
  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_CHARS) return;
    const ask = ++latest.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await loadPlaces();
        session.current ??= new AutocompleteSessionToken();
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          sessionToken: session.current,
          includedRegionCodes: ["in"],
        });
        if (ask !== latest.current) return;
        setResults(suggestions.slice(0, 6));
        setActive(0);
        setUnavailable(false);
      } catch (error) {
        console.error("Google Places search failed", error);
        if (ask === latest.current) setUnavailable(true);
      } finally {
        if (ask === latest.current) setBusy(false);
      }
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [query]);

  async function choose(suggestion: PlaceSuggestion) {
    setOpen(false);
    setQuery(suggestion.placePrediction.text.text);
    setBusy(true);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ["id", "location", "displayName", "formattedAddress", "addressComponents"] });
      await onPick(place);
    } catch (error) {
      console.error("Google Places details failed", error);
      setUnavailable(true);
    } finally {
      session.current = undefined; // a pick ends the billing session; the next search starts a new one
      setBusy(false);
    }
  }

  const showList = open && results.length > 0 && query.trim().length >= MIN_CHARS;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-[1.125rem] left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id={id}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={id ? `${id}-places` : undefined}
        className="pr-9 pl-9"
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          if (next.trim().length < MIN_CHARS) setResults([]);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && showList) {
            e.stopPropagation(); // closes the list, not the dialog around it
            setOpen(false);
          } else if (showList && e.key === "ArrowDown") {
            e.preventDefault();
            setActive((active + 1) % results.length);
          } else if (showList && e.key === "ArrowUp") {
            e.preventDefault();
            setActive((active + results.length - 1) % results.length);
          } else if (e.key === "Enter" && showList) {
            e.preventDefault(); // never submits the form
            void choose(results[Math.min(active, results.length - 1)]);
          }
        }}
      />
      {busy ? (
        <Loader2 className="absolute top-[1.125rem] right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
      {showList ? (
        // onMouseDown keeps the box focused, so the click lands before the blur closes the list.
        <ul
          id={id ? `${id}-places` : undefined}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {results.map((suggestion, index) => {
            const { text, mainText, secondaryText } = suggestion.placePrediction;
            return (
              <li
                key={text.text}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => void choose(suggestion)}
                className={cn("flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm", index === active && "bg-muted")}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{mainText?.text ?? text.text}</span>
                  {secondaryText?.text ? <span className="block truncate text-xs text-muted-foreground">{secondaryText.text}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {unavailable ? (
        <p className="mt-1.5 text-xs text-muted-foreground">Google search is not available right now. Type the address below instead.</p>
      ) : null}
    </div>
  );
}
