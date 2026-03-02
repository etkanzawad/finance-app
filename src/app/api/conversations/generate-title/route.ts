import { NextRequest, NextResponse } from "next/server";
import { getAI, MODEL } from "@/lib/chat-helpers";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ title: "New Chat" });
  }

  try {
    const ai = getAI();
    const preview = messages
      .slice(0, 4)
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join("\n");

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Given this conversation, generate a short title (3-5 words, no quotes). Just respond with the title, nothing else.\n\n${preview}`,
            },
          ],
        },
      ],
    });

    const title = response.text?.trim() || "New Chat";

    return NextResponse.json({ title });
  } catch {
    return NextResponse.json({ title: "New Chat" });
  }
}
