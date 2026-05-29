import {
  useInfiniteQuery,
  type InfiniteData,
  type QueryFunctionContext,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryReturnType
} from "@tanstack/vue-query";
import {
  doubletGroupsQuerySchema,
  doubletGroupsResultSchema,
  type DoubletGroupsQuery,
  type DoubletGroupsResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

type DoubletGroupsBaseQuery = Omit<DoubletGroupsQuery, "cursor">;
type DoubletGroupsPageParam = string | undefined;

export type DoubletGroupsQueryKey = readonly ["doubletGroups", DoubletGroupsBaseQuery | null];

export type DoubletGroupsInfiniteData = InfiniteData<DoubletGroupsResult, DoubletGroupsPageParam>;

export type DoubletGroupsQueryOptions = Omit<
  UseInfiniteQueryOptions<
    DoubletGroupsResult,
    Error,
    DoubletGroupsInfiniteData,
    DoubletGroupsQueryKey,
    DoubletGroupsPageParam
  >,
  "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

/** Builds the cache key for language-wide doublet group browsing. */
export function doubletGroupsQueryKey(query: DoubletGroupsBaseQuery | null): DoubletGroupsQueryKey {
  return ["doubletGroups", query] as const;
}

/** Validates group browsing input while leaving cursor state to TanStack pages. */
function resolveDoubletGroupsQuery(
  input: MaybeRefOrGetter<DoubletGroupsBaseQuery | null>
): DoubletGroupsBaseQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return doubletGroupsQuerySchema.omit({ cursor: true }).parse(query);
}

/** Fetches one page of shared-ancestor doublet groups for a language. */
export async function fetchDoubletGroups(
  input: DoubletGroupsBaseQuery,
  cursor?: string,
  signal?: AbortSignal
): Promise<DoubletGroupsResult> {
  const query = doubletGroupsQuerySchema.parse({
    ...input,
    cursor
  });
  const params = new URLSearchParams({
    langCode: query.langCode,
    maxDepth: String(query.maxDepth),
    limit: String(query.limit),
    entryLimit: String(query.entryLimit)
  });

  if (query.cursor) {
    params.set("cursor", query.cursor);
  }

  const response = await fetch(buildApiUrl(`/api/doublet-groups?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Doublet groups failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = doubletGroupsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Doublet groups response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete infinite-query options object for language-wide doublet groups. */
export function doubletGroupsQuery(
  input: MaybeRefOrGetter<DoubletGroupsBaseQuery | null>
): UseInfiniteQueryOptions<
  DoubletGroupsResult,
  Error,
  DoubletGroupsInfiniteData,
  DoubletGroupsQueryKey,
  DoubletGroupsPageParam
> {
  return {
    queryKey: computed(() => doubletGroupsQueryKey(resolveDoubletGroupsQuery(input))),
    queryFn: ({ signal, pageParam }: QueryFunctionContext<DoubletGroupsQueryKey, DoubletGroupsPageParam>) => {
      const query = resolveDoubletGroupsQuery(input);

      if (query === null) {
        throw new Error("Doublet group browsing requires a selected language");
      }

      return fetchDoubletGroups(query, pageParam, signal);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage: DoubletGroupsResult) => lastPage.nextCursor,
    enabled: computed(() => resolveDoubletGroupsQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack infinite loading for doublet group result lists. */
export function useDoubletGroupsQuery(
  input: MaybeRefOrGetter<DoubletGroupsBaseQuery | null>,
  options?: DoubletGroupsQueryOptions
): UseInfiniteQueryReturnType<DoubletGroupsInfiniteData, Error> {
  return useInfiniteQuery({
    ...doubletGroupsQuery(input),
    ...(options ?? {})
  });
}
