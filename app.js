/* =========================================================
   ANANTAM EDU AI — APP.JS
   Clean AI Markdown formatting + Chat + Notes + Exam
   ========================================================= */

const navs = document.querySelectorAll(".nav");

/* =========================
   NAVIGATION
========================= */

function show(id) {
  document.querySelectorAll(".screen").forEach(x => {
    x.classList.remove("active");
  });

  const screen = document.getElementById(id);
  if (screen) screen.classList.add("active");

  navs.forEach(n => {
    n.classList.toggle("active", n.dataset.id === id);
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

navs.forEach(n => {
  n.onclick = () => show(n.dataset.id);
});

/* =========================
   CHAT OPEN
========================= */

function openChat() {
  show("chat");

  setTimeout(() => {
    const input = document.getElementById("chatInput");
    if (input) input.focus();
  }, 100);
}

function chatWith(text) {
  show("chat");

  setTimeout(() => {
    const input = document.getElementById("chatInput");
    const form = document.getElementById("chatForm");

    if (input && form) {
      input.value = text;

      form.dispatchEvent(
        new Event("submit", {
          bubbles: true,
          cancelable: true
        })
      );
    }
  }, 150);
}

/* =========================
   SECURITY ESCAPE
========================= */

function esc(value) {
  if (value === null || value === undefined) return "";

  return String(value).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

/* =========================
   MARKDOWN → HTML
========================= */

function markdownToHtml(markdown) {
  if (!markdown) return "";

  let text = String(markdown)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  /* Escape HTML first */
  text = esc(text);

  /* Code blocks */
  text = text.replace(
    /([\s\S]*?)/g,
    '<pre class="ai-code"><code>$1</code></pre>'
  );

  /* Inline code */
  text = text.replace(
    /([^\n]+)`/g,
    "<code>$1</code>"
  );

  /* Bold + italic */
  text = text.replace(
    /\\\(.+?)\\\/g,
    "<strong><em>$1</em></strong>"
  );

  text = text.replace(
    /\\(.+?)\\/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /_(.+?)_/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /(^|[^\])\([^\n]+)\(?!\*)/g,
    "$1<em>$2</em>"
  );

  text = text.replace(
    /(^|[^])([^\n]+)(?!_)/g,
    "$1<em>$2</em>"
  );

  /* Headings */
  text = text.replace(
    /^###### (.+)$/gm,
    "<h6>$1</h6>"
  );

  text = text.replace(
    /^##### (.+)$/gm,
    "<h5>$1</h5>"
  );

  text = text.replace(
    /^#### (.+)$/gm,
    "<h4>$1</h4>"
  );

  text = text.replace(
    /^### (.+)$/gm,
    "<h3>$1</h3>"
  );

  text = text.replace(
    /^## (.+)$/gm,
    "<h2>$1</h2>"
  );

  text = text.replace(
    /^# (.+)$/gm,
    "<h1>$1</h1>"
  );

  /* Horizontal rules */
  text = text.replace(
    /^\s*([-_])(?:\s\1){2,}\s*$/gm,
    "<hr>"
  );

  /* Links */
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  /*
     Convert bullet lists.
     Supports:
     - item
     * item
     + item
  */

  const lines = text.split("\n");
  let html = "";
  let inList = false;
  let listType = null;

  function closeList() {
    if (inList) {
      html += listType === "ol" ? "</ol>" : "</ul>";
      inList = false;
      listType = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    /* Blank line */
    if (!line.trim()) {
      closeList();
      continue;
    }

    /* Unordered list */
    let bullet = line.match(/^\s*[-*+]\s+(.+)$/);

    if (bullet) {
      if (!inList || listType !== "ul") {
        closeList();
        html += "<ul>";
        inList = true;
        listType = "ul";
      }

      html += <li>${bullet[1]}</li>;
      continue;
    }

    /* Ordered list */
    let numbered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (numbered) {
      if (!inList || listType !== "ol") {
        closeList();
        html += "<ol>";
        inList = true;
        listType = "ol";
      }

      html += <li>${numbered[1]}</li>;
      continue;
    }

    closeList();

    /* Blockquote */
    if (/^\s*&gt;\s?/.test(line)) {
      html += <blockquote>${line.replace(/^\s*&gt;\s?/, "")}</blockquote>;
      continue;
    }

    /* Already generated HTML elements */
    if (
      /^<(h[1-6]|pre|hr|blockquote|ul|ol)/i.test(line.trim())
    ) {
      html += line;
      continue;
    }

    /* Normal paragraph */
    html += <p>${line}</p>;
  }

  closeList();

  return html;
}

/* =========================
   ADD CHAT MESSAGE
========================= */

function addMsg(text, user = false) {
  const box = document.getElementById("messages");

  if (!box) return;

  const d = document.createElement("div");

  d.className = "message " + (user ? "user" : "ai");

  if (user) {
    d.innerHTML = `
      <div class="bubble">
        ${esc(text)}
      </div>
    `;
  } else {
    d.innerHTML = `
      <img src="/assets/icon.svg"
           alt="Anantam Edu AI"
           onerror="this.style.display='none'">

      <div class="bubble">
        <b>Anantam Edu AI</b>
        <div class="ai-response">
          ${markdownToHtml(text)}
        </div>
      </div>
    `;
  }

  box.appendChild(d);

  box.scrollTop = box.scrollHeight;
}

/* =========================
   AI BACKEND
========================= */

async function askBackend(prompt) {
  const status = document.getElementById("aiStatus");

  if (status) {
    status.textContent = "● Thinking…";
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message: prompt,
        userName: "Amit"
      })
    });

    if (!response.ok) {
      throw new Error("AI request failed");
    }

    const data = await response.json();

    return data.reply || "I couldn't generate a response.";
  } catch (error) {
    console.error("AI error:", error);

    return localReply(prompt);
  } finally {
    if (status) {
      status.textContent = "● Ready";
    }
  }
}

/* =========================
   OFFLINE FALLBACK
========================= */

function localReply(question) {
  const x = String(question).toLowerCase();

  if (x.includes("photosynthesis")) {
    return `
### 🌱 Photosynthesis

Photosynthesis is the process by which *green plants make their own food* using sunlight.

*Plants need:*
- Sunlight
- Water
- Carbon dioxide
- Chlorophyll

*Simple equation:*

Carbon dioxide + Water + Sunlight → Glucose + Oxygen

### Remember

Plants use *sunlight to make food* and release *oxygen*.
`;
  }

  if (
    x.includes("math") ||
    x.includes("solve") ||
    x.includes("calculate")
  ) {
    return `
### 🧮 Maths Question

Send me the *complete question*.

I will explain the solution:

1. Given information
2. Formula
3. Calculation
4. Final answer
5. Easy explanation
`;
  }

  return `
### 👋 Welcome to Anantam Edu AI

I can help you with:

- 📚 Explain topics
- 🧮 Solve questions
- 📝 Make notes
- 📄 Create exam papers
- 🎯 Practice questions
- 💡 Revision
- 📖 Homework help

Ask me any study question!
`;
}

/* =========================
   CHAT FORM
========================= */

const chatForm = document.getElementById("chatForm");

if (chatForm) {
  chatForm.onsubmit = async function(e) {
    e.preventDefault();

    const input = document.getElementById("chatInput");

    if (!input) return;

    const question = input.value.trim();

    if (!question) return;

    /* User message */
    addMsg(question, true);

    input.value = "";

    /* Disable while thinking */
    input.disabled = true;

    try {
      const answer = await askBackend(question);

      addMsg(answer, false);
    } catch (error) {
      addMsg(
        "Sorry, something went wrong. Please try again.",
        false
      );
    }

    input.disabled = false;
    input.focus();
  };
}

/* =========================
   NOTES GENERATOR
========================= */

async function generateNotes() {
  const topic = document.getElementById("noteTopic")?.value || "";
  const className = document.getElementById("noteClass")?.value || "";
  const subject = document.getElementById("noteSubject")?.value || "";
  const language = document.getElementById("noteLang")?.value || "";

  const output = document.getElementById("noteOutput");

  if (!output) return;

  output.innerHTML = `
    <div class="note-card">
      Generating your notes…
    </div>
  `;

  try {
    const response = await fetch("/api/notes", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        topic,
        className,
        subject,
        language,
        userName: "Amit"
      })
    });

    if (!response.ok) {
      throw new Error("Notes request failed");
    }

    const data = await response.json();

    const content =
      data.html ||
      markdownToHtml(data.text || "");

    output.innerHTML = `
      <div class="note-card">
        <h3>
          ${esc(topic)} — ${esc(className)}
        </h3>

        ${content}
      </div>
    `;

  } catch (error) {
    console.error(error);

    output.innerHTML = `
      <div class="note-card">

        <h3>
          ${esc(topic)} — ${esc(className)}
        </h3>

        <ul>
          <li>Definition and core idea</li>
          <li>Important terms and keywords</li>
          <li>Main process / formula / examples</li>
          <li>Common exam points</li>
          <li>Quick revision summary</li>
        </ul>

        <p>
          <b>AI backend:</b>
          Please check your AI environment variables.
        </p>

      </div>
    `;
  }
}

/* =========================
   EXAM GENERATOR
========================= */

async function generateExam() {

  const data = {
    className:
      document.getElementById("examClass")?.value || "",

    subject:
      document.getElementById("examSubject")?.value || "",

    marks:
      document.getElementById("marks")?.value || "",

    difficulty:
      document.getElementById("difficulty")?.value || "",

    topics:
      document.getElementById("examTopics")?.value || "",

    mix:
      document.getElementById("mix")?.value || "",

    userName: "Amit"
  };

  const output = document.getElementById("examOutput");

  if (!output) return;

  output.innerHTML = `
    <div class="note-card">
      Preparing your question paper…
    </div>
  `;

  try {

    const response = await fetch("/api/exam", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error("Exam request failed");
    }

    const result = await response.json();

    if (result.html) {
      output.innerHTML = result.html;
    } else if (result.text) {
      output.innerHTML = `
        <div class="paper">
          ${markdownToHtml(result.text)}
        </div>
      `;
    } else {
      throw new Error("No exam response");
    }

  } catch (error) {

    console.error(error);

    output.innerHTML = demoExam(data);
  }
}

/* =========================
   DEMO EXAM FALLBACK
========================= */

function demoExam(data) {

  return `
    <div class="paper">

      <div class="paper-head">

        <img
          src="/assets/icon.svg"
          alt="Anantam Edu AI"
          onerror="this.style.display='none'"
        >

        <h2>ANANTAM EDU AI</h2>

        <p>
          ${esc(data.className)}
          •
          ${esc(data.subject)}
        </p>

        <p>
          EXAM PREPARATION QUESTION PAPER
          •
          ${esc(data.marks)} MARKS
        </p>

      </div>

      <h3>Section A — MCQ</h3>

      <div class="q">
        1. Choose the correct answer.
        (5 × 1 = 5)
      </div>

      <div class="q">
        2. Which concept is most closely related to
        ${esc(data.topics || "the chapter")}?
      </div>

      <div class="q">
        3. Write one important definition from the chapter.
      </div>

      <h3>Section B — Short Answer</h3>

      <div class="q">
        4. Explain the main concept in your own words.
      </div>

      <div class="q">
        5. Give two examples and explain them.
      </div>

      <h3>Section C — Long Answer</h3>

      <div class="q">
        6. Answer a detailed question covering
        the key ideas of the chapter.
      </div>

    </div>
  `;
}

/* =========================
   QUIZ ANSWER
========================= */

function pick(button, correct) {

  document
    .querySelectorAll(".answers button")
    .forEach(x => {
      x.disabled = true;
    });

  button.classList.add(
    correct ? "good" : "bad"
  );

  const result = document.getElementById("result");

  if (result) {
    result.textContent = correct
      ? "✓ Correct!"
      : "✗ Try again next time.";
  }
}

/* =========================
   THEME
========================= */

const themeButton =
  document.getElementById("themeBtn");

if (themeButton) {

  themeButton.onclick = () => {

    document.body.classList.toggle("light");

    themeButton.textContent =
      document.body.classList.contains("light")
        ? "☀️"
        : "☾";
  };
}

/* =========================
   INITIAL STATUS
========================= */

const status = document.getElementById("aiStatus");

if (status) {
  status.textContent = "● Ready";
}
