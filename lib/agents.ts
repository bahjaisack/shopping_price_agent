import {
  createAgent,
  createTool,
  openai as openRouterAdapter,
} from "@inngest/agent-kit";

import {
  searchShippingPricesTool,
  scrapeWebpageTool,
} from "./tools/serper";

import { z } from "zod";

const model = openRouterAdapter({
  model: "openrouter/free",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: "https://openrouter.ai/api/v1",
  defaultParameters: {
    temperature: 0.2,
  },
});

export async function searchProducts(query: string) {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    throw new Error("SERPER_API_KEY is missing.");
  }

  const response = await fetch("https://google.serper.dev/shopping", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: 20,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.status}`);
  }

  const data = await response.json();

  const products = Array.isArray(data.shopping)
    ? data.shopping.map((product: any) => ({
        title: product.title ?? "",
        source: product.source ?? "",
        price: product.price ?? null,
        link: product.link ?? null,
        productId: product.productId ?? null,
        image: product.image ?? product.imageUrl ?? product.thumbnail ?? null,
        rating: product.rating ?? null,
        ratingCount: product.ratingCount ?? null,
      }))
    : [];

  return {
    query,
    products,
  };
}

const searchProductsTool = createTool({
  name: "search_products",
  description: "Search Google Shopping for product offers.",
  parameters: z.object({
    query: z.string(),
  }),
  handler: async ({ query }) => {
    return await searchProducts(query);
  },
});

// 1. Search Agent
export const searchAgent = createAgent({
  name: "Search Agent",
  description: "Finds products and online sellers worldwide.",
  model,
  system: `
    You are a product and shipping research specialist.

    1. Use search_products to find products and online sellers.
    2. Use search_shipping_prices to research shipping prices,
       delivery services and shipping costs.
    3. Use scrape_webpage to read relevant seller and shipping company webpages.
    4. Extract real prices, currencies, delivery times and shipping conditions.
    5. Never invent prices, sellers or shipping information.
  `,
  tools: [
    searchProductsTool,
    searchShippingPricesTool,
    scrapeWebpageTool,
  ],
});

// 2. Product Verification Agent
export const verificationAgent = createAgent({
  name: "Product Verification Agent",
  description: "Checks whether products match the requested model.",
  model,
  system: `
    You are a product verification specialist.

    You receive product search results as JSON.

    Check product names, model numbers, storage capacity,
    specifications and relevance to the user's search.

    Reject unrelated products.
    Never assume missing specifications are verified.

    Preserve the original title, seller, price, link and image.
    Do not invent missing information.

    Return the verified products as JSON.
    Do not return explanations or Markdown.
  `,
});

// 3. Price Extraction Agent
export const priceAgent = createAgent({
  name: "Price Extraction Agent",
  description: "Identifies full product prices and seller details.",
  model,
  system: `
    You are a price extraction specialist.

    You receive verified product data as JSON.

    Identify the full purchase price and currency.
    Distinguish full prices from monthly payments,
    deposits, financing and installment prices.

    Never invent a price.
    Preserve the original seller link and product information.

    Return the products as JSON.
    Do not return explanations or Markdown.
  `,
});

// 4. Condition Classification Agent
export const conditionAgent = createAgent({
  name: "Condition Classification Agent",
  description: "Classifies products as new, used or refurbished.",
  model,
  system: `
    You are a product condition specialist.

    You receive product data as JSON.

    Classify each product as:
    NEW, USED, REFURBISHED or UNKNOWN.

    Use only evidence in the product title and seller information.
    Never guess when condition is unclear.

    Preserve all original product information.
    Return the products as JSON.
    Do not return explanations or Markdown.
  `,
});

// 5. Comparison Agent
export const comparisonAgent = createAgent({
  name: "Price Comparison Agent",
  description: "Compares and ranks verified product offers.",
  model,
  system: `
    You are a shopping price comparison specialist.

    You receive classified product data as JSON.

    Compare matching products using their full purchase prices.
    Keep different currencies separate.
    Exclude monthly payment amounts from full-price rankings.
    Group products by condition.
    Sort verified offers from cheapest to most expensive.

    Never invent or modify prices.
    Preserve original seller names and product links.

    Return ONLY valid JSON using this structure:

    {
      "products": [
        {
          "title": "Product name",
          "seller": "Seller name",
          "price": "Original price",
          "url": "Original product URL",
          "image": "Image URL or null",
          "rating": null,
          "ratingCount": null,
          "condition": "NEW, USED, REFURBISHED or UNKNOWN"
        }
      ],
      "websites": []
    }

    Do not include Markdown or explanations.
  `,
});
