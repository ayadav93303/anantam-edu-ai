// Anantam Edu AI V3 — AI backend
// Gemini / OpenAI support
// API keys stay safely on the server.

const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const PROVIDER = (process.env.AI_PROVIDER || "gemini").toLowerCase();

const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "gpt-5.6";

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash";

/* =========================================================
   SECURITY / HTML HELPERS
========================================================= */

function esc(value) {
  return String(value ?? "").replace(/[<>&"']/g, char => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

/*
  Convert simple AI Markdown into clean HTML.

  Supports:
  *bold*
  italic
  code
  ### headings
  - bullet lists
  1. numbered lists
  paragraphs
*/

function inlineMarkdown(text) {
  let s = esc(text);

  // Inline code
  s = s.replace(/([^]+)`/g, "<code>$1</code>");

  // Bold with **
  s = s.replace(/\\(.+?)\\/g, "<strong>$1</strong>");

  // Bold with __
  s = s.replace(/_(.+?)_/g, "<strong>$1</strong>");

  return s;
}

function markdownToHtml(input) {
  const text = String(input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!text) return "<p>No answer was generated.</p>";

  const lines = text.split("\n");

  let html = "";
  let inUl = false;
  let inOl = false;
  let paragraph = [];

  function closeLists() {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }

    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  }

  function flushParagraph() {
    if (!paragraph.length) return;

    const content = paragraph
      .map(x => inlineMarkdown(x))
      .join(" ");

    if (content.trim()) {
      html += <p>${content}</p>;
    }

    paragraph = [];
  }

  for (let line of lines) {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }

    // Headings
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      closeLists();

      const level = Math.min(heading[1].length + 1, 4);

      html += `<h${level}>${inlineMarkdown(
        heading[2]
      )}</h${level}>`;

      continue;
    }

    // Bullet list
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);

    if (bullet) {
      flushParagraph();

      if (inOl) {
        html += "</ol>";
        inOl = false;
      }

      if (!inUl) {
        html += "<ul>";
        inUl = true;
      }

      html += <li>${inlineMarkdown(bullet[1])}</li>;

      continue;
    }

    // Numbered list
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (numbered) {
      flushParagraph();

      if (inUl) {
        html += "</ul>";
        inUl = false;
      }

      if (!inOl) {
        html += "<ol>";
        inOl = true;
      }

      html += <li>${inlineMarkdown(numbered[1])}</li>;

      continue;
    }

    // Blockquote
    const quote = trimmed.match(/^>\s*(.+)$/);

    if (quote) {
      flushParagraph();
      closeLists();

      html += `<blockquote>${inlineMarkdown(
        quote[1]
      )}</blockquote>`;

      continue;
    }

    // Horizontal line
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      closeLists();
      html += "<hr>";
      continue;
    }

    // Normal text
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeLists();

  return html;
}

/* =========================================================
   OPENAI
========================================================= */

async function callOpenAI(messages) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization":
          Bearer ${process.env.OPENAI_API_KEY}
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: messages.map(message => ({
          role: message.role,
          content: message.content
        }))
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      OpenAI ${response.status}: ${await response.text()}
    );
  }

  const data = await response.json();

  return (
    data.output_text ||
    data.output
      ?.flatMap(item => item.content || [])
      .map(item => item.text || "")
      .join("") ||
    ""
  );
}

/* =========================================================
   GEMINI
========================================================= */

async function callGemini(messages) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const system = messages
    .filter(message => message.role === "system")
    .map(message => message.content)
    .join("\n");

  const contents = messages
    .filter(message => message.role !== "system")
    .map(message => ({
      role:
        message.role === "assistant"
          ? "model"
          : "user",
      parts: [
        {
          text: message.content
        }
      ]
    }));

  const url =
    https://generativelanguage.googleapis.com/v1beta/models/ +
    ${encodeURIComponent(GEMINI_MODEL)} +
    :generateContent?key= +
    ${encodeURIComponent(process.env.GEMINI_API_KEY)};

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      systemInstruction: system
        ? {
            parts: [
              {
                text: system
              }
            ]
          }
        : undefined,

      contents,

      generationConfig: {
        temperature: 0.4
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      Gemini ${response.status}: ${await response.text()}
    );
  }

  const data = await response.json();

  return (
    data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("") || ""
  );
}

/* =========================================================
   AI PROVIDER
========================================================= */

async function ai(messages) {
  let providers;

  if (PROVIDER === "openai") {
    providers = ["openai"];
  } else if (PROVIDER === "gemini") {
    providers = ["gemini"];
  } else {
    providers = ["gemini", "openai"];
  }

  const errors = [];

  for (const provider of providers) {
    try {
      const result =
        provider === "gemini"
          ? await callGemini(messages)
          : await callOpenAI(messages);

      if (result) {
        return result;
      }
    } catch (error) {
      console.error(
        ${provider} error:,
        error.message
      );

      errors.push(error.message);
    }
  }

  throw new Error(
    errors.join(" | ") ||
    "No AI provider available"
  );
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    provider: PROVIDER,
    openaiConfigured:
      !!process.env.OPENAI_API_KEY,
    geminiConfigured:
      !!process.env.GEMINI_API_KEY
  });
});

/* =========================================================
   CHAT
========================================================= */

app.post("/api/chat", async (req, res) => {
  const message = String(
    req.body.message || ""
  ).slice(0, 12000);

  const name = String(
    req.body.userName || "Amit"
  );

  if (!message.trim()) {
    return res.status(400).json({
      error: "Please enter a question."
    });
  }

  try {
    const reply = await ai([
      {
        role: "system",

        content: `
You are Anantam Edu AI, a friendly and intelligent
school-study assistant.

Address the student as ${name} when appropriate.

Your job is to help students:
- understand concepts
- solve questions
- revise chapters
- prepare for exams
- create study material

Give accurate, student-friendly explanations.

Use simple English, Hindi or Hinglish when useful.

Structure answers clearly.

Use Markdown naturally:
- headings
- bullet points
- numbered steps
- bold important terms

For science and mathematics, show steps clearly.

Do not unnecessarily repeat the question.

Never claim certainty when information is uncertain.
        `.trim()
      },

      {
        role: "user",
        content: message
      }
    ]);

    res.json({
      reply: markdownToHtml(reply)
    });

  } catch (error) {
    console.error("Chat error:", error);

    res.status(503).json({
      error:
        "No configured AI provider is currently available.",
      detail: error.message
    });
  }
});

/* =========================================================
   NOTES
========================================================= */

app.post("/api/notes", async (req, res) => {
  const {
    topic,
    className,
    subject,
    language,
    userName = "Amit"
  } = req.body;

  try {
    const reply = await ai([
      {
        role: "system",

        content: `
You are Anantam Edu AI.

Create concise, accurate and exam-friendly
revision notes.

Student: ${userName}
Class: ${className}
Subject: ${subject}
Language: ${language}

Use clear Markdown formatting.

Include:
1. Definition
2. Key points
3. Important terms
4. Examples
5. Formulas where relevant
6. Common exam points
7. Quick revision summary
        `.trim()
      },

      {
        role: "user",
        content: Create notes for: ${topic}
      }
    ]);

    res.json({
      html: markdownToHtml(reply)
    });

  } catch (error) {
    console.error("Notes error:", error);

    res.status(503).json({
      error:
        "No configured AI provider is currently available.",
      detail: error.message
    });
  }
});

/* =========================================================
   EXAM PAPER
========================================================= */

app.post("/api/exam", async (req, res) => {
  const {
    className,
    subject,
    marks,
    difficulty,
    topics,
    mix,
    userName = "Amit"
  } = req.body;

  try {
    const reply = await ai([
      {
        role: "system",

        content: `
You are Anantam Edu AI exam-paper generator.

Student: ${userName}
Class: ${className}
Subject: ${subject}
Total Marks: ${marks}
Difficulty: ${difficulty}
Topics: ${topics || "Full syllabus"}
Question Mix: ${mix}

Create a realistic school examination paper.

Use Markdown.

Include:
- clear sections
- question numbering
- marks for questions
- balanced topic coverage
- total marks

Do NOT provide answers.
        `.trim()
      },

      {
        role: "user",
        content:
          "Generate the complete question paper now."
      }
    ]);

    const html = markdownToHtml(reply);

    res.json({
      html: `
        <div class="paper">

          <div class="paper-head">

            <img
              src="/assets/icon.svg"
              alt="Anantam Edu AI"
            >

            <h2>ANANTAM EDU AI</h2>

            <p>
              ${esc(className)}
              •
              ${esc(subject)}
            </p>

            <p>
              EXAM PREPARATION
              •
              ${esc(marks)} MARKS
            </p>

          </div>

          ${html}

        </div>
      `
    });

  } catch (error) {
    console.error("Exam error:", error);

    res.status(503).json({
      error:
        "No configured AI provider is currently available.",
      detail: error.message
    });
  }
});

/* =========================================================
   FRONTEND
========================================================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log(
    Anantam Edu AI running on port ${PORT}
  );
});
