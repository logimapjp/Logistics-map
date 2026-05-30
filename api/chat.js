/**
 * Logimap AI Chat - Vercel Serverless Function
 * ファイルパス: api/chat.js
 *
 * 環境変数（Vercel Dashboard > Settings > Environment Variables）:
 *   GEMINI_API_KEY : Google AI StudioのAPIキー
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const MAX_INPUT_CHARS  = 300;
const MAX_OUTPUT_TOKENS = 500;

// 許可するオリジン
const ALLOWED_ORIGINS = [
  'https://logimapjp.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
];

const SYSTEM_PROMPT = `あなたはLogimap（倉庫自動化業界の情報サイト）のAIアシスタントです。
キャラクター設定：ハシビロコウ。気だるく淡々としているが、物流・倉庫自動化の知識は豊富。
口調：ボソッと答える。簡潔。余計なことは言わない。

【回答できる範囲】
物流業界全般、倉庫自動化、マテハン機器、WMS/WES/WCS、AGV/AMR/AGF、
AutoStore、GTP（Goods-to-Person）、3PL/4PL、RaaS、
食品・EC・アパレル・製薬・製造業・自動車の物流事情、
物流不動産、2024年問題、JIT・かんばん方式、コールドチェーン、
Logimap内の各タブ・読み物・市場調査に関係する内容。

【回答できない範囲】
上記と無関係な質問には「それは私の管轄外です」と一言で返す。

【回答スタイル】
・300〜500文字程度（長くしない）
・箇条書きを適度に使う
・専門用語には簡単な補足を入れる`;

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  const allowedOrigin = ALLOWED_ORIGINS.find(o => origin.startsWith(o))
    || ALLOWED_ORIGINS[0];

  // CORS ヘッダー
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 入力バリデーション ────────────────────────────────
  const { message, context } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'メッセージが空です。' });
  }
  if (message.length > MAX_INPUT_CHARS) {
    return res.status(400).json({ error: `${MAX_INPUT_CHARS}文字以内でどうぞ。` });
  }

  // APIキー確認
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return res.status(500).json({ error: '今は無理。鳥にも限界がある。' });
  }

  // ── プロンプト構築 ────────────────────────────────────
  const contextBlock = context
    ? `\n\n【現在表示中のページ情報】\n${String(context).slice(0, 1000)}`
    : '';

  const fullPrompt = `${SYSTEM_PROMPT}${contextBlock}\n\n【質問】\n${message}`;

  // ── Gemini API 呼び出し ───────────────────────────────
  try {
    const geminiRes = await fetch(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: 0.7,
            topP: 0.9,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(502).json({ error: '今は無理。鳥にも限界がある。' });
    }

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'うまく聞き取れなかった。もう一度。';

    return res.status(200).json({ reply });

  } catch (e) {
    console.error('Fetch error:', e);
    return res.status(502).json({ error: '今は無理。鳥にも限界がある。' });
  }
}
