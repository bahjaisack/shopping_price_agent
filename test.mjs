const response = await fetch(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [
        {
          role: "user",
          content: "Reply with only the word OK.",
        },
      ],
    }),
  }
);

const body = await response.text();

console.log("HTTP STATUS:", response.status);
console.log("RAW RESPONSE:", body);