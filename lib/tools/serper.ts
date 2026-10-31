import { createTool } from "@inngest/agent-kit";
import { z } from "zod";

export const searchShippingPricesTool = createTool({
  name: "search_shipping_prices",
  description:
    "Search Google for shipping prices, courier rates, freight costs, and delivery services.",

  parameters: z.object({
    query: z.string().describe("The shipping service or route to search for"),
  }),

  handler: async (input, { network, step }) => {
    const results = await step?.run("search-shipping-prices", async () => {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: input.query,
          num: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`Serper search failed: ${response.status}`);
      }

      return await response.json();
    });

    const articles = results?.organic || [];

    if (network) {
      network.state.data.articles = articles;
    }

    return {
      success: true,
      count: articles.length,
      articles,
    };
  },
});

export const scrapeWebpageTool = createTool({
  name: "scrape_webpage",
  description:
    "Open a shipping company webpage and extract its actual content, including shipping prices and delivery information.",

  parameters: z.object({
    url: z.string().url().describe("The webpage URL to read"),
  }),

  handler: async (input, { step }) => {
    const webpage = await step?.run("scrape-webpage", async () => {
      const response = await fetch("https://scrape.serper.dev", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: input.url,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webpage scraping failed: ${response.status}`);
      }

      return await response.json();
    });

    return {
      success: true,
      url: input.url,
      webpage,
    };
  },
});
