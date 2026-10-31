import { inngest } from "./inngest";
import {
  searchProducts,
  verificationAgent,
  priceAgent,
  conditionAgent,
  comparisonAgent,
} from "./agents";

import { getDatabase } from "./mongodb";

function extractAgentText(result: any): string {
  if (typeof result === "string") {
    return result;
  }

  if (Array.isArray(result?.output)) {
    return result.output
      .map((item: any) => item.content ?? "")
      .filter(Boolean)
      .join("\n");
  }

  if (typeof result?.output === "string") {
    return result.output;
  }

  return JSON.stringify(result);
}

function parseAgentJSON(text: string): any {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Agent did not return valid JSON.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

export const shoppingWorkflow = inngest.createFunction(
  {
    id: "shopping-price-comparison",
    name: "Shopping Price Comparison Workflow",
  },
  {
    event: "shopping/search.requested",
  },
  async ({ event, step }) => {
    const query = event.data.query as string;
    const searchId = event.data.searchId as string;

    const productSearch = await step.run(
      "search-products",
      async () => {
        return await searchProducts(query);
      }
    );

    console.log(
      "PRODUCT SEARCH RESULTS:",
      productSearch.products.length
    );

    const verifiedResults = await verificationAgent.run(
      JSON.stringify(productSearch.products),
      { step }
    );

    const verifiedText = extractAgentText(verifiedResults);

    const extractedPrices = await priceAgent.run(
      verifiedText,
      { step }
    );

    const priceText = extractAgentText(extractedPrices);

    const classifiedProducts = await conditionAgent.run(
      priceText,
      { step }
    );

    const conditionText = extractAgentText(classifiedProducts);

    const comparison = await comparisonAgent.run(
      conditionText,
      { step }
    );

    const comparisonText = extractAgentText(comparison);

    console.log(
      "COMPARISON AGENT OUTPUT:",
      comparisonText
    );

    let comparisonData: any;

    try {
      comparisonData = parseAgentJSON(comparisonText);
    } catch {
      comparisonData = {
        products: productSearch.products.map((product: any) => ({
          title: product.title,
          seller: product.source,
          price: product.price,
          url: product.link,
          image: product.image,
          rating: product.rating,
          ratingCount: product.ratingCount,
          condition: "UNKNOWN",
        })),
        websites: [],
        comparisonError: "Comparison agent did not return valid JSON.",
      };
    }

    if (!Array.isArray(comparisonData.products)) {
      comparisonData.products = [];
    }

if (
  !Array.isArray(comparisonData.products) ||
  comparisonData.products.length === 0
) {
  console.log("Comparison Agent returned no products. Using original Serper results.");

  comparisonData.products = productSearch.products.map((product: any) => ({
    title: product.title,
    seller: product.source,
    price: product.price,
    url: product.link,
    image: product.image,
    rating: product.rating,
    ratingCount: product.ratingCount,
    condition: "UNKNOWN",
  }));
}

if (
  !Array.isArray(comparisonData.websites) ||
  comparisonData.websites.length === 0
) {
  comparisonData.websites = Array.from(
    new Map(
      productSearch.products
        .filter((product: any) => product.source && product.link)
        .map((product: any) => [
          product.source.trim().toLowerCase(),
          {
            title: product.source,
            url: product.link,
            snippet: `View ${product.source} offers for ${query}.`,
          },
        ])
    ).values()
  );
}

    await step.run("save-comparison", async () => {
      const db = await getDatabase();

      await db.collection("searches").updateOne(
        { searchId },
        {
          $set: {
            searchId,
            query,
            results: comparisonData,
            status: "completed",
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      return { searchId };
    });

    return {
      success: true,
      query,
      results: comparisonData,
      searchId,
    };
  }
);
