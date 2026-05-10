import { createLogger } from "../../../shared/logger";

const log = createLogger("sentiment-ingestion");

export type SentimentSource = "twitter" | "reddit" | "news" | "all";

export type SentimentDocument = {
  source: "cryptopanic" | "newsapi" | "gnews" | "reddit" | "coinstats";
  symbol: string;
  title: string;
  text: string;
  url?: string;
  publishedAt?: string;
};

export type CorpusRequest = {
  symbols: string[];
  lookbackHours: number;
  source: SentimentSource;
};

const SYMBOL_ALIASES: Record<string, string[]> = {
  BTC: ["BTC", "Bitcoin"],
  ETH: ["ETH", "Ethereum", "Ether"],
  SOL: ["SOL", "Solana"],
};

const DEFAULT_REDDIT_SUBREDDITS = [
  "CryptoCurrency",
  "Bitcoin",
  "ethereum",
  "solana",
  "defi",
];

const maxDocsPerSymbol = (): number => {
  const raw = Number(process.env["SENTIMENT_MAX_DOCS_PER_SYMBOL"] ?? "24");
  return Number.isFinite(raw) ? Math.max(3, Math.min(raw, 80)) : 24;
};

export const fetchSentimentCorpus = async (
  req: CorpusRequest
): Promise<Record<string, SentimentDocument[]>> => {
  const corpus: Record<string, SentimentDocument[]> = {};
  for (const symbol of req.symbols) corpus[symbol] = [];

  const tasks: Array<Promise<void>> = [];

  if (req.source === "news" || req.source === "all") {
    tasks.push(collectInto(corpus, fetchCryptoPanic(req)));
    tasks.push(collectInto(corpus, fetchNewsApi(req)));
    tasks.push(collectInto(corpus, fetchGNews(req)));
    tasks.push(collectInto(corpus, fetchCoinStats(req)));
  }

  if (req.source === "reddit" || req.source === "all") {
    tasks.push(collectInto(corpus, fetchReddit(req)));
  }

  await Promise.all(tasks);

  for (const symbol of req.symbols) {
    corpus[symbol] = dedupeDocuments(corpus[symbol] ?? []).slice(0, maxDocsPerSymbol());
    if (!corpus[symbol].length) {
      corpus[symbol] = [{
        source: "newsapi",
        symbol,
        title: `${symbol} market sentiment`,
        text: `${symbol} market sentiment over the last ${req.lookbackHours} hours`,
      }];
      log.warn("No live text found, using minimal fallback text", { symbol });
    }
  }

  return corpus;
};

const collectInto = async (
  corpus: Record<string, SentimentDocument[]>,
  docsPromise: Promise<SentimentDocument[]>
): Promise<void> => {
  try {
    const docs = await docsPromise;
    for (const doc of docs) {
      corpus[doc.symbol] = corpus[doc.symbol] ?? [];
      corpus[doc.symbol].push(doc);
    }
  } catch (err) {
    log.warn("Sentiment source failed", { error: String(err) });
  }
};

const fetchJson = async <T>(url: string, headers?: Record<string, string>): Promise<T> => {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Nexus-402/0.1 sentiment-ingestion",
      ...headers,
    },
    signal: AbortSignal.timeout(Number(process.env["SENTIMENT_FETCH_TIMEOUT_MS"] ?? "8000")),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }

  return await res.json() as T;
};

const aliasesFor = (symbol: string): string[] => SYMBOL_ALIASES[symbol.toUpperCase()] ?? [symbol];

const queryFor = (symbol: string): string => {
  const aliases = aliasesFor(symbol).map((alias) => `"${alias}"`);
  return `(${aliases.join(" OR ")}) AND (crypto OR blockchain OR token OR market)`;
};

const publishedAfter = (lookbackHours: number): Date =>
  new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

async function fetchCryptoPanic(req: CorpusRequest): Promise<SentimentDocument[]> {
  const token = process.env["CRYPTOPANIC_API_KEY"] ?? process.env["CRYPTOPANIC_AUTH_TOKEN"];
  if (!token) return [];

  const baseUrl = process.env["CRYPTOPANIC_API_URL"] ?? "https://cryptopanic.com/api/free/v1/posts/";
  const url = new URL(baseUrl);
  url.searchParams.set("auth_token", token);
  url.searchParams.set("public", "true");
  url.searchParams.set("currencies", req.symbols.join(","));
  url.searchParams.set("kind", "news");
  url.searchParams.set("regions", "en");

  type CryptoPanicPost = {
    title?: string;
    url?: string;
    published_at?: string;
    currencies?: Array<{ code?: string }>;
    source?: { title?: string; domain?: string };
  };
  const body = await fetchJson<{ results?: CryptoPanicPost[] }>(url.toString());
  const after = publishedAfter(req.lookbackHours);

  return (body.results ?? []).flatMap((post) => {
    const publishedAt = post.published_at ? new Date(post.published_at) : null;
    if (publishedAt && publishedAt < after) return [];

    const symbols = (post.currencies ?? [])
      .map((currency) => currency.code?.toUpperCase())
      .filter((code): code is string => {
        return typeof code === "string" && req.symbols.includes(code);
      });

    return symbols.map((symbol) => ({
      source: "cryptopanic" as const,
      symbol,
      title: post.title ?? "",
      text: [post.title, post.source?.title, post.source?.domain].filter(Boolean).join(". "),
      url: post.url,
      publishedAt: post.published_at,
    }));
  });
}

async function fetchNewsApi(req: CorpusRequest): Promise<SentimentDocument[]> {
  const token = process.env["NEWSAPI_KEY"];
  if (!token) return [];

  const docs: SentimentDocument[] = [];
  for (const symbol of req.symbols) {
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", queryFor(symbol));
    url.searchParams.set("searchIn", "title,description,content");
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("from", publishedAfter(req.lookbackHours).toISOString());
    url.searchParams.set("pageSize", String(Math.min(maxDocsPerSymbol(), 100)));

    type NewsApiArticle = {
      title?: string;
      description?: string;
      content?: string;
      url?: string;
      publishedAt?: string;
      source?: { name?: string };
    };
    const body = await fetchJson<{ articles?: NewsApiArticle[] }>(url.toString(), {
      "X-Api-Key": token,
    });

    docs.push(...(body.articles ?? []).map((article) => ({
      source: "newsapi" as const,
      symbol,
      title: article.title ?? "",
      text: [article.title, article.description, article.content, article.source?.name]
        .filter(Boolean)
        .join(". "),
      url: article.url,
      publishedAt: article.publishedAt,
    })));
  }

  return docs;
}

async function fetchGNews(req: CorpusRequest): Promise<SentimentDocument[]> {
  const token = process.env["GNEWS_API_KEY"];
  if (!token) return [];

  const docs: SentimentDocument[] = [];
  for (const symbol of req.symbols) {
    const url = new URL("https://gnews.io/api/v4/search");
    url.searchParams.set("q", queryFor(symbol));
    url.searchParams.set("lang", "en");
    url.searchParams.set("from", publishedAfter(req.lookbackHours).toISOString());
    url.searchParams.set("max", String(Math.min(maxDocsPerSymbol(), 10)));
    url.searchParams.set("apikey", token);

    type GNewsArticle = {
      title?: string;
      description?: string;
      content?: string;
      url?: string;
      publishedAt?: string;
      source?: { name?: string };
    };
    const body = await fetchJson<{ articles?: GNewsArticle[] }>(url.toString());

    docs.push(...(body.articles ?? []).map((article) => ({
      source: "gnews" as const,
      symbol,
      title: article.title ?? "",
      text: [article.title, article.description, article.content, article.source?.name]
        .filter(Boolean)
        .join(". "),
      url: article.url,
      publishedAt: article.publishedAt,
    })));
  }

  return docs;
}

async function fetchReddit(req: CorpusRequest): Promise<SentimentDocument[]> {
  const subreddits = (process.env["REDDIT_SUBREDDITS"] ?? DEFAULT_REDDIT_SUBREDDITS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const docs: SentimentDocument[] = [];
  for (const symbol of req.symbols) {
    const query = aliasesFor(symbol).join(" OR ");
    for (const subreddit of subreddits) {
      const url = new URL(`https://www.reddit.com/r/${subreddit}/search.json`);
      url.searchParams.set("q", query);
      url.searchParams.set("restrict_sr", "1");
      url.searchParams.set("sort", "new");
      url.searchParams.set("t", req.lookbackHours <= 24 ? "day" : "week");
      url.searchParams.set("limit", "12");

      type RedditChild = {
        data?: {
          title?: string;
          selftext?: string;
          permalink?: string;
          created_utc?: number;
          subreddit?: string;
        };
      };
      const body = await fetchJson<{ data?: { children?: RedditChild[] } }>(url.toString());
      const afterSeconds = publishedAfter(req.lookbackHours).getTime() / 1000;

      docs.push(...(body.data?.children ?? []).flatMap((child) => {
        const post = child.data;
        if (!post?.title || (post.created_utc && post.created_utc < afterSeconds)) return [];
        return [{
          source: "reddit" as const,
          symbol,
          title: post.title,
          text: [post.title, post.selftext, `r/${post.subreddit ?? subreddit}`].filter(Boolean).join(". "),
          url: post.permalink ? `https://www.reddit.com${post.permalink}` : undefined,
          publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : undefined,
        }];
      }));
    }
  }

  return docs;
}

async function fetchCoinStats(req: CorpusRequest): Promise<SentimentDocument[]> {
  const token = process.env["COINSTATS_API_KEY"];
  if (!token) return [];

  const docs: SentimentDocument[] = [];
  for (const symbol of req.symbols) {
    const url = new URL("https://openapiv1.coinstats.app/news");
    url.searchParams.set("limit", String(Math.min(maxDocsPerSymbol(), 20)));

    type CoinStatsArticle = {
      title?: string;
      description?: string;
      source?: string;
      link?: string;
      imgUrl?: string;
      feedDate?: number;
      coins?: Array<{ symbol?: string }>;
    };
    const body = await fetchJson<{ news?: CoinStatsArticle[] }>(url.toString(), {
      "X-API-KEY": token,
    });

    const afterMs = publishedAfter(req.lookbackHours).getTime();
    const aliases = aliasesFor(symbol).map((a) => a.toLowerCase());

    docs.push(...(body.news ?? []).flatMap((article) => {
      if (article.feedDate && article.feedDate * 1000 < afterMs) return [];
      const coinMatch = (article.coins ?? []).some(
        (c) => aliases.includes((c.symbol ?? "").toLowerCase())
      );
      const textMatch = aliases.some((a) =>
        (article.title ?? "").toLowerCase().includes(a) ||
        (article.description ?? "").toLowerCase().includes(a)
      );
      if (!coinMatch && !textMatch) return [];
      return [{
        source: "coinstats" as const,
        symbol,
        title: article.title ?? "",
        text: [article.title, article.description, article.source].filter(Boolean).join(". "),
        url: article.link,
        publishedAt: article.feedDate ? new Date(article.feedDate * 1000).toISOString() : undefined,
      }];
    }));
  }

  return docs;
}

const dedupeDocuments = (docs: SentimentDocument[]): SentimentDocument[] => {
  const seen = new Set<string>();
  const deduped: SentimentDocument[] = [];

  for (const doc of docs) {
    const key = (doc.url || doc.title || doc.text).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(doc);
  }

  return deduped;
};
