"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Product = {
  title: string;
  seller: string;
  price: string | null;
  url: string | null;
  image: string | null;
  rating: number | null;
  ratingCount: number | null;
};

type Website = {
  title: string;
  url: string | null;
  snippet: string;
};

const POLL_INTERVAL = 2000;
const MAX_WAIT_TIME = 15 * 60 * 1000; // 15 minutes

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [condition, setCondition] = useState("all");

  async function searchProducts() {
    if (!query.trim() || loading) return;

    setLoading(true);
    setError("");
    setSearched(false);
    setProducts([]);
    setWebsites([]);
    setCondition("all");

    const currentQuery = query.trim();

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: currentQuery }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search could not be started.");
      }

      const searchId = data.searchId;

      if (!searchId) {
        throw new Error("Search ID was not returned by the server.");
      }

      const startedAt = Date.now();
      let completed = false;

      while (Date.now() - startedAt < MAX_WAIT_TIME) {
        await new Promise((resolve) =>
          setTimeout(resolve, POLL_INTERVAL)
        );

        const resultResponse = await fetch(
          `/api/search?id=${encodeURIComponent(searchId)}`,
          { cache: "no-store" }
        );

        const resultData = await resultResponse.json();

        if (!resultResponse.ok) {
          throw new Error(
            resultData.error || "Unable to retrieve search results."
          );
        }

        if (resultData.status === "failed") {
          throw new Error(
            resultData.error || "The shopping workflow failed."
          );
        }

        if (resultData.status !== "completed") {
          continue;
        }

        const comparison = resultData.results ?? {};

        const rawProducts = Array.isArray(comparison.products)
          ? comparison.products
          : [];

        const normalizedProducts: Product[] = rawProducts.map(
          (product: any) => ({
            title: product.title ?? "Product name unavailable",
            seller:
              product.seller ??
              product.source ??
              "Unknown seller",
            price: product.price ?? null,
            url: product.url ?? product.link ?? null,
            image:
              product.image ??
              product.thumbnail ??
              null,
            rating:
              typeof product.rating === "number"
                ? product.rating
                : null,
            ratingCount:
              typeof product.ratingCount === "number"
                ? product.ratingCount
                : typeof product.rating_count === "number"
                  ? product.rating_count
                  : null,
          })
        );

        const rawWebsites = Array.isArray(comparison.websites)
          ? comparison.websites
          : [];

        let normalizedWebsites: Website[] = rawWebsites.map(
          (website: any) => ({
            title: website.title ?? website.name ?? "Shopping website",
            url: website.url ?? website.link ?? null,
            snippet: website.snippet ?? "",
          })
        );

        if (normalizedWebsites.length === 0) {
          const uniqueSellers = new Map<string, Website>();

          for (const product of normalizedProducts) {
            const seller = product.seller.trim();

            if (
              seller &&
              seller.toLowerCase() !== "unknown seller" &&
              !uniqueSellers.has(seller.toLowerCase())
            ) {
              uniqueSellers.set(seller.toLowerCase(), {
                title: seller,
                url: product.url,
                snippet: `Shopping offers found for ${currentQuery}.`,
              });
            }
          }

          normalizedWebsites = Array.from(uniqueSellers.values());
        }

        setProducts(normalizedProducts);
        setWebsites(normalizedWebsites);
        setSearchedQuery(currentQuery);
        setSearched(true);

        completed = true;
        break;
      }

      if (!completed) {
        throw new Error(
          `Your search is still processing. Search ID: ${searchId}. ` +
          "The workflow has not reported completion yet. Please try checking again shortly."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function priceValue(price: string | null) {
    if (!price || /\/mo\b|per month|monthly/i.test(price)) {
      return Number.POSITIVE_INFINITY;
    }

    const match = price
      .replace(/,/g, "")
      .match(/\d+(?:\.\d+)?/);

    return match
      ? Number(match[0])
      : Number.POSITIVE_INFINITY;
  }

  const filteredProducts = products.filter((product) => {
    const text =
      `${product.title} ${product.seller}`.toLowerCase();

    if (condition === "new") {
      return !/used|refurbished|renewed|pre-owned|preowned/i.test(text);
    }

    if (condition === "used") {
      return /used|pre-owned|preowned/i.test(text);
    }

    if (condition === "refurbished") {
      return /refurbished|renewed/i.test(text);
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort(
    (a, b) => priceValue(a.price) - priceValue(b.price)
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-2xl font-bold tracking-tight">
            Price<span className="text-emerald-400">Finder</span>
          </a>

          <span className="text-sm text-slate-400">
            Compare prices worldwide
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <Badge className="mb-4 border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
          Smarter shopping starts here
        </Badge>

        <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
          Find the best
          <span className="block text-emerald-400">
            price for anything.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-slate-400">
          Search products, compare sellers, and discover offers
          from different shopping websites.
        </p>

        <form
          className="mx-auto mt-9 flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            searchProducts();
          }}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product..."
            className="h-12 flex-1 border-0 bg-transparent text-white shadow-none focus-visible:ring-0"
            maxLength={300}
            disabled={loading}
            aria-label="Search for a product"
          />

          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-12 bg-emerald-400 px-7 font-bold text-slate-950 hover:bg-emerald-300"
          >
            {loading ? "Searching..." : "Search prices"}
          </Button>
        </form>

        {error && (
          <p className="mt-5 break-words text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-6 text-slate-400" role="status">
            <p>Searching shopping offers and comparing sellers...</p>
            <p className="mt-2 text-xs text-slate-500">
              This can take several minutes. Please keep this page open.
            </p>
          </div>
        )}
      </section>

      {searched && (
        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold">Search results</h2>
              <p className="mt-1 text-sm text-slate-400">
                {sortedProducts.length} offers found for "{searchedQuery}".
                Prices and product conditions may need seller verification.
              </p>
            </div>

            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="w-full border-slate-700 bg-slate-900 text-white sm:w-56">
                <SelectValue placeholder="Filter by condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conditions</SelectItem>
                <SelectItem value="new">Likely new</SelectItem>
                <SelectItem value="used">Used</SelectItem>
                <SelectItem value="refurbished">
                  Refurbished / renewed
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sortedProducts.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900 text-white">
              <CardContent className="p-8 text-slate-400">
                No offers found. Try another product.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedProducts.map((product, index) => (
                <Card
                  key={`${product.title}-${product.seller}-${index}`}
                  className="flex flex-col border-slate-800 bg-slate-900 text-white transition hover:border-emerald-400/60"
                >
                  <CardContent className="flex flex-1 flex-col p-5">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="mb-4 h-44 w-full rounded-xl bg-white object-contain p-3"
                        loading="lazy"
                      />
                    ) : (
                      <div className="mb-4 flex h-44 items-center justify-center rounded-xl bg-slate-800 text-slate-500">
                        No image available
                      </div>
                    )}

                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                      {product.seller}
                    </p>

                    <h3 className="mt-2 flex-1 font-semibold leading-6">
                      {product.title}
                    </h3>

                    <p className="mt-4 text-2xl font-bold">
                      {product.price || "Price unavailable"}
                    </p>

                    {product.rating != null && (
                      <p className="mt-2 text-sm text-slate-400">
                        Rating: {product.rating}/5
                        {product.ratingCount != null
                          ? ` (${product.ratingCount} reviews)`
                          : ""}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      Sorted by displayed price. Monthly-payment offers
                      appear after offers with full prices.
                    </p>

                    {product.url ? (
                      <Button
                        asChild
                        variant="outline"
                        className="mt-5 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-slate-950"
                      >
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View offer ↗
                        </a>
                      </Button>
                    ) : (
                      <p className="mt-5 text-center text-sm text-slate-500">
                        Seller link unavailable
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-16">
            <h2 className="mb-2 text-2xl font-bold">
              More shopping websites
            </h2>
            <p className="mb-5 text-sm text-slate-400">
              Sellers identified from your product offers.
            </p>

            {websites.length === 0 ? (
              <p className="text-sm text-slate-500">
                No seller websites were identified in these results.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {websites.map((website, index) => (
                  <Card
                    key={`${website.title}-${index}`}
                    className="border-slate-800 bg-slate-900 text-white"
                  >
                    <CardContent className="p-5">
                      <h3 className="font-semibold">{website.title}</h3>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {website.snippet}
                      </p>

                      {website.url && (
                        <a
                          href={website.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block text-sm font-semibold text-emerald-400 hover:underline"
                        >
                          View seller offers ↗
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="border-t border-slate-800 px-6 py-7 text-center text-sm text-slate-500">
        PriceFinder · Compare carefully. Seller prices and availability can change.
      </footer>
    </main>
  );
}
