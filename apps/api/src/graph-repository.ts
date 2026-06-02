import type {
  AncestorPathQuery,
  AncestorPathResult,
  AncestorsQuery,
  AncestorsResult,
  ChildTermsQuery,
  ChildTermsResult,
  ComparisonSetQuery,
  ComparisonSetResult,
  DoubletGroupsQuery,
  DoubletGroupsResult,
  DoubletsQuery,
  DoubletsResult,
  LanguageDetailResult,
  LanguagesResult,
  SearchTermsQuery,
  SearchTermsResult,
  TermEntriesQuery,
  TermEntriesResult,
  TermsWithAncestorLanguageQuery,
  TermsWithAncestorLanguageResult
} from "@etymology-graph/graph";

export type GraphRepository = {
  listLanguages(): Promise<LanguagesResult>;
  findLanguage(langCode: string): Promise<LanguageDetailResult | undefined>;
  searchTerms(query: SearchTermsQuery): Promise<SearchTermsResult>;
  listTermEntries(query: TermEntriesQuery): Promise<TermEntriesResult>;
  findAncestors(query: AncestorsQuery): Promise<AncestorsResult>;
  findAncestorPath(query: AncestorPathQuery): Promise<AncestorPathResult>;
  findComparisonSet(query: ComparisonSetQuery): Promise<ComparisonSetResult>;
  findChildTerms(query: ChildTermsQuery): Promise<ChildTermsResult>;
  findDoublets(query: DoubletsQuery): Promise<DoubletsResult>;
  findDoubletGroups(query: DoubletGroupsQuery): Promise<DoubletGroupsResult>;
  findTermsWithAncestorLanguage(
    query: TermsWithAncestorLanguageQuery
  ): Promise<TermsWithAncestorLanguageResult>;
};
