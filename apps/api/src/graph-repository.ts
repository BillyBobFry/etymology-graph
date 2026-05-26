import type {
  AncestorsQuery,
  AncestorsResult,
  ChildTermsQuery,
  ChildTermsResult,
  DoubletsQuery,
  DoubletsResult,
  LanguagesResult,
  SearchTermsQuery,
  SearchTermsResult
} from "@etymology-graph/graph";

export type GraphRepository = {
  listLanguages(): Promise<LanguagesResult>;
  searchTerms(query: SearchTermsQuery): Promise<SearchTermsResult>;
  findAncestors(query: AncestorsQuery): Promise<AncestorsResult>;
  findChildTerms(query: ChildTermsQuery): Promise<ChildTermsResult>;
  findDoublets(query: DoubletsQuery): Promise<DoubletsResult>;
};
