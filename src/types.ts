export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface FetchResult {
  url: string;
  content: string;
  tokens: number;
}
