export interface PageResponse {
  status: number;
  headers: Headers;
  html: string;
}
export interface PageTransport {
  name: 'direct' | 'brightdata';
  maxAttempts: number;
  fetchPage(url: URL): Promise<PageResponse>;
}
