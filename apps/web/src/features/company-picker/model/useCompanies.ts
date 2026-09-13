import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CancelledError,
  createCompanyDataSource,
  type CatalogFilter,
  type CompanySummary,
} from "@entities/company";

export interface CompaniesState {
  companies: CompanySummary[];
  defaultCompany: string;
  loading: boolean;
  /** Why the catalogue could not be read. There is no fallback list: offering
   *  a stale one would let someone pick a company the service cannot analyse. */
  error?: string;
  filter: CatalogFilter;
  setFilter: (filter: CatalogFilter) => void;
}

/** Reads the company catalogue, debounced so typing in the search box does not
 *  fire a request per keystroke. */
export function useCompanies(enabled: boolean): CompaniesState {
  const source = useMemo(() => createCompanyDataSource(), []);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [defaultCompany, setDefaultCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [filter, setFilter] = useState<CatalogFilter>({ limit: 40 });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setLoading(true);
      source
        .list(filter, controller.signal)
        .then((catalog) => {
          if (controller.signal.aborted) return;
          setCompanies(catalog.companies);
          setDefaultCompany(catalog.defaultCompany);
          setError(undefined);
          setLoading(false);
        })
        .catch((failure: unknown) => {
          if (failure instanceof CancelledError) return;
          if (controller.signal.aborted) return;
          setError(
            failure instanceof Error
              ? failure.message
              : "No pudimos leer el catálogo de empresas.",
          );
          setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [source, filter, enabled]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const update = useCallback((next: CatalogFilter) => setFilter(next), []);

  return {
    companies,
    defaultCompany,
    loading,
    error,
    filter,
    setFilter: update,
  };
}
