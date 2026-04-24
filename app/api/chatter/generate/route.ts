import { NextRequest, NextResponse } from "next/server";
import { ObsidianClient } from "@/lib/obsidian";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY;
const OBSIDIAN_PORT = process.env.OBSIDIAN_PORT || '27124';

export async function POST(req: NextRequest) {
  try {
    const { message, clientId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!OBSIDIAN_API_KEY) {
      return NextResponse.json({ error: "Obsidian API Key not configured" }, { status: 500 });
    }

    const obsidian = new ObsidianClient(OBSIDIAN_API_KEY, OBSIDIAN_PORT);
    
    // 1. Search for relevant context in Obsidian
    // Simple RAG: Search for keywords from the message
    const keywords = message.split(' ').filter((w: string) => w.length > 4).slice(0, 5).join(' ');
    const notePaths = await obsidian.searchNotes(keywords || "script chatting theory");
    
    // 2. Fetch content of top 3 relevant notes
    let context = "";
    for (const path of notePaths.slice(0, 3)) {
      const content = await obsidian.getNote(path);
      if (content) {
        context += `\n--- SOURCE: ${path} ---\n${content}\n`;
      }
    }

    // 3. Call Gemini
    const systemPrompt = `
      You are an expert OnlyFans Chatter Assistant. Your goal is to maximize earnings by providing highly engaging, seductive, and personalized responses.
      Use the provided KNOWLEDGE BASE (from Obsidian) to align with established scripts, theory, and chatting frameworks.
      
      KNOWLEDGE BASE CONTEXT:
      ${context || "No specific notes found. Use general expert chatting principles: GFE (Girlfriend Experience), building rapport, and strategic upselling."}
      
      TONE GUIDELINES:
      - Highly personalized
      - Seductive but authentic
      - Focused on building a "Girlfriend Experience" (GFE)
      - Always include a subtle "hook" or question to keep the conversation going
      - Reference scripts if they fit the situation
    `;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: `CUSTOMER MESSAGE: "${message}"\n\nGenerate the best possible response based on our scripts and theory.` }]
        }
      ],
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 500,
      }
    };

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const error = await geminiRes.text();
      return NextResponse.json({ error: `Gemini Error: ${error}` }, { status: 500 });
    }

    const data = await geminiRes.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({ 
      suggestion: responseText,
      sources: notePaths.slice(0, 3)
    });

  } catch (error: any) {
    console.error('Chatter API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
