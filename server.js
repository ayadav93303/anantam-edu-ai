// Anantam Edu AI V3 — dual AI backend
// Node 18+
// npm install && npm start
//
// Configure BOTH or either provider on the server:
// OPENAI_API_KEY=...
// OPENAI_MODEL=gpt-5.6
// GEMINI_API_KEY=...
// GEMINI_MODEL=gemini-3.6-flash
//
// AI_PROVIDER=auto | openai | gemini
// auto = try OpenAI first, then Gemini if OpenAI fails.
//
// IMPORTANT: API keys must remain server-side.
// No provider can guarantee unlimited usage; provider quotas/rate limits/billing still apply.

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));
const PORT = process.env.PORT || 3000;

const PROVIDER = (process.env.AI_PROVIDER || "auto").toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

function esc(s){
  return String(s ?? "").replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
}
function textToHtml(s){return esc(s).replace(/\n/g,"<br>");}

async function callOpenAI(messages){
  if(!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENAI_API_KEY}`},
    body:JSON.stringify({
      model:OPENAI_MODEL,
      input:messages.map(m=>({role:m.role,content:m.content})),
      temperature:.4
    })
  });
  if(!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const j=await r.json();
  return j.output_text || j.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("") || "";
}

async function callGemini(messages){
  if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
  const contents=messages.filter(m=>m.role!=="system").map(m=>({
    role:m.role==="assistant"?"model":"user",
    parts:[{text:m.content}]
  }));
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const r=await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      systemInstruction: system ? {parts:[{text:system}]} : undefined,
      contents,
      generationConfig:{temperature:.4}
    })
  });
  if(!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j=await r.json();
  return j.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("") || "";
}

async function ai(messages){
  const attempts = PROVIDER==="openai" ? ["openai"] :
                   PROVIDER==="gemini" ? ["gemini"] : ["openai","gemini"];
  const errors=[];
  for(const p of attempts){
    try{
      const out=p==="openai"?await callOpenAI(messages):await callGemini(messages);
      if(out) return out;
    }catch(e){errors.push(e.message)}
  }
  throw new Error(errors.join(" | ") || "No AI provider available");
}

app.get("/api/health",(req,res)=>{
  res.json({
    ok:true,
    provider:PROVIDER,
    openaiConfigured:!!process.env.OPENAI_API_KEY,
    geminiConfigured:!!process.env.GEMINI_API_KEY
  });
});

app.post("/api/chat",async(req,res)=>{
  const message=String(req.body.message||"").slice(0,12000);
  const name=String(req.body.userName||"Amit");
  try{
    const reply=await ai([
      {role:"system",content:`You are Anantam Edu AI, a friendly school-study assistant. Address the student as ${name}. Explain clearly and step by step. Use English, Hindi or Hinglish when useful. Help with homework, concepts, revision and exam preparation. Never claim certainty when the answer is uncertain.`},
      {role:"user",content:message}
    ]);
    res.json({reply:textToHtml(reply)});
  }catch(e){res.status(503).json({error:"No configured AI provider is currently available.",detail:e.message});}
});

app.post("/api/notes",async(req,res)=>{
  const {topic,className,subject,language,userName="Amit"}=req.body;
  try{
    const reply=await ai([
      {role:"system",content:`You are Anantam Edu AI. Create concise, accurate, exam-friendly revision notes. Student: ${userName}. Class: ${className}. Subject: ${subject}. Language: ${language}. Return ONLY HTML using h3, p, ul, li, strong. Include definition, key points, examples, important terms/formulas, common exam points and a quick revision summary.`},
      {role:"user",content:`Create notes for: ${topic}`}
    ]);
    res.json({html:reply});
  }catch(e){res.status(503).json({error:"No configured AI provider is currently available.",detail:e.message});}
});

app.post("/api/exam",async(req,res)=>{
  const {className,subject,marks,difficulty,topics,mix,userName="Amit"}=req.body;
  try{
    const reply=await ai([
      {role:"system",content:`You are Anantam Edu AI exam-paper generator. Student: ${userName}. Create a realistic school exam paper for ${className}, ${subject}, total ${marks} marks, difficulty ${difficulty}, topics: ${topics||"full syllabus"}, mix: ${mix}. Return ONLY HTML using h3,p,ol,li,strong and tables where useful. Include sections, question numbering, marks per question, balanced coverage, and total marks. Do not provide answers.`},
      {role:"user",content:"Generate the complete question paper now."}
    ]);
    res.json({html:`<div class="paper"><div class="paper-head"><img src="/assets/icon.svg"><h2>ANANTAM EDU AI</h2><p>${esc(className)} • ${esc(subject)}</p><p>EXAM PREPARATION • ${esc(marks)} MARKS</p></div>${reply}</div>`});
  }catch(e){res.status(503).json({error:"No configured AI provider is currently available.",detail:e.message});}
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Anantam Edu AI V3 running on ${PORT}`));
