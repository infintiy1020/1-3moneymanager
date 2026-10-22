// 입금 알림 → 학급비 자동 충전 (Vercel 서버리스 함수)
const admin = require("firebase-admin");
const crypto = require("crypto");

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  return admin.firestore();
}

// 알림 문구에서 금액과 이름 뽑기 (예: "홍길동님이 5,000원을 보냈어요", "입금 5,000원 홍길동")
function parse(text) {
  if (!/입금|보냈|받았|들어왔/.test(text)) return { reason: "입금 알림이 아니에요 (입금/보냈/받았 글자 없음)" };
  if (/출금|결제|송금완료/.test(text) && !/입금|보냈어요|받았/.test(text)) return { reason: "출금 알림이에요" };
  const m = text.match(/([\d,]{3,})\s*원/);
  if (!m) return { reason: "금액(○○원)을 못 찾았어요" };
  const amount = parseInt(m[1].replace(/,/g, ""), 10);
  if (!amount) return { reason: "금액이 0원이에요" };
  const n = text.match(/([가-힣A-Za-z]{2,10})\s*님/) || text.match(/원\s*[을를]?\s*([가-힣A-Za-z]{2,10})/);
  return { amount, name: n ? n[1] : "익명" };
}

function readText(req) {
  const b = req.body;
  if (req.method === "GET") return String(req.query.text || "");
  if (b && typeof b === "object") return String(b.text || b.message || JSON.stringify(b));
  if (typeof b === "string") {
    try { const j = JSON.parse(b); return String(j.text || j.message || b); } catch (e) { return b; }
  }
  return "";
}

module.exports = async (req, res) => {
  try {
    const secret = req.headers["x-secret"] || (req.query && req.query.secret);
    if (!process.env.DEPOSIT_SECRET) return res.status(500).json({ ok: false, error: "DEPOSIT_SECRET 환경변수가 없어요" });
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(500).json({ ok: false, error: "FIREBASE_SERVICE_ACCOUNT 환경변수가 없어요" });
    if (secret !== process.env.DEPOSIT_SECRET) return res.status(401).json({ ok: false, error: "비밀키가 달라요" });

    const text = readText(req);
    const dryRun = req.query && req.query.dry === "1"; // 주소창 테스트용: 파싱만 확인, 충전은 안 함
    const p = parse(text);
    if (!p.amount) return res.status(200).json({ ok: false, text, ...p });
    if (dryRun) return res.status(200).json({ ok: true, dryRun: true, ...p });

    const db = getDb();
    const key = crypto.createHash("sha1").update(text + Math.floor(Date.now() / 60000)).digest("hex");
    const dep = db.doc("deposits/" + key), fund = db.doc("fund/state");
    const result = await db.runTransaction(async (t) => {
      if ((await t.get(dep)).exists) return "duplicate";
      const cur = await t.get(fund);
      const d = cur.exists ? cur.data() : { balance: 50000, log: [] };
      const log = [{ name: p.name, amount: p.amount, at: Date.now() }, ...(d.log || [])].slice(0, 30);
      t.set(fund, { balance: d.balance + p.amount, log });
      t.set(dep, { amount: p.amount, name: p.name, at: Date.now() });
      return "charged";
    });
    res.status(200).json({ ok: true, result, ...p });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
