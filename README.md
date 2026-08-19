# Anantam Edu AI V3 — OpenAI + Gemini

This version keeps the personalized Anantam Edu AI frontend and adds a dual-provider backend.

## AI routing
- `AI_PROVIDER=auto`: OpenAI first; Gemini fallback if OpenAI is unavailable.
- `AI_PROVIDER=openai`: OpenAI only.
- `AI_PROVIDER=gemini`: Gemini only.

## Environment variables
OPENAI_API_KEY
OPENAI_MODEL
GEMINI_API_KEY
GEMINI_MODEL
AI_PROVIDER

## Security
Keys must be set as server environment variables. Do NOT put them into public JavaScript, HTML, or an Android APK. OpenAI explicitly recommends keeping API keys secret and server-side. Gemini also documents using environment variables for API keys.

## Run
Node.js 18+
npm install
npm start

## Deploy
Deploy the root folder as a Node.js web service. Add the environment variables in the host dashboard.

## Important
This does not bypass provider limits. It can fail over from OpenAI to Gemini, but each provider still controls its own quotas, rate limits, safety systems and billing.

## Frontend-only APK
The `public` folder can be wrapped as a web app, but the real AI endpoints must remain hosted on the server. The APK should call the deployed backend URL rather than contain secret API keys.
