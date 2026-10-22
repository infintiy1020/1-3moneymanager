// Vercel 서버리스 함수: 입금 알림 문자열을 받아 학급비를 자동 충전합니다.
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();

// 알림 예: "홍길동님이 5,000원을 보냈어요" / "입금 5,000원 홍길동"
function parse(text) {
  if (/출금|송금했|보냈어요.*내가/.test(text) && !/입금/.test(text)) return null;
  if (!/입금|보냈|받았/.test(text)) return null;
  const m = text.match(/([\d,]+)\s*원/);
  if (!m) return null;
  const amount = parseInt(m[1].replace(/,/g, ""), 10);
  if (!amount || amount <= 0) return null;
  const n = text.match(/([가-힣A-Za-z]{2,10})님/) || text.match(/원\s+([가-힣A-Za-z]{2,10})/);
  return { amount, name: n ? n[1] : "익명" };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (req.headers["x-secret"] !== process.env.DEPOSIT_SECRET) return res.status(401).end();

  const text = String((req.body && req.body.text) || "");
  const p = parse(text);
  if (!p) return res.status(200).json({ ok: false, reason: "입금 알림이 아님" });

  // 같은 알림이 두 번 와도 한 번만 충전 (같은 문자열 + 같은 분)
  const key = crypto.createHash("sha1").update(text + Math.floor(Date.now() / 60000)).digest("hex");
  const dep = db.doc("deposits/" + key), fund = db.doc("fund/state");

  const result = await db.runTransaction(async (t) => {
    if ((await t.get(dep)).exists) return "duplicate";
    const cur = await t.get(fund);
    const d = cur.exists ? cur.data() : { balance: 50000, log: [] };
    const log = [{ name: p.name, amount: p.amount, at: Date.now() }, ...(d.log || [])].slice(0, 30);
    t.set(fund, { balance: d.balance + p.amount, log });
    t.set(dep, { ...p, at: Date.now() });
    return "charged";
  });
  res.status(200).json({ ok: true, result, ...p });
};
