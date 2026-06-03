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
  LanguageTermsQuery,
  LanguageTermsResult,
  LanguagesResult,
  SearchTermsQuery,
  SearchTermsResult,
  SimilarTermsQuery,
  SimilarTermsResult,
  SourceLanguageLayersQuery,
  SourceLanguageLayersResult,
  TermEntriesQuery,
  TermEntriesResult,
  TermsWithAncestorLanguageQuery,
  TermsWithAncestorLanguageResult
} from "@etymology-graph/graph";

export type GraphRepository = {
  listLanguages(): Promise<LanguagesResult>;
  findLanguage(langCode: string): Promise<LanguageDetailResult | undefined>;
  findLanguageTerms(query: LanguageTermsQuery): Promise<LanguageTermsResult | undefined>;
  listSourceLanguageLayers(query: SourceLanguageLayersQuery): Promise<SourceLanguageLayersResult>;
  searchTerms(query: SearchTermsQuery): Promise<SearchTermsResult>;
  findSimilarTerms(query: SimilarTermsQuery): Promise<SimilarTermsResult>;
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
