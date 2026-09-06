const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;

async function fetchNews() {
  console.log("1. กำลังดึงข่าว...");
  var res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "(agriculture OR farming) AND (technology OR AI OR IoT)",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 5,
      apiKey: NEWSAPI_KEY,
    },
  });
  if (!res.data.articles || !res.data.articles.length) {
    throw new Error("No news found");
  }
  var index = Math.floor(Math.random() * Math.min(5, res.data.articles.length));
  var article = res.data.articles[index];
  console.log("   ข่าว:", article.title);
  return article;
}

async function writeArticle(title, description) {
  console.log("2. กำลังเขียนบทความข่าว (Gemini)...");
  var prompt = "คุณเป็นนักข่าวสายเทคโนโลยีการเกษตรของไทย เขียนบทความข่าวภาษาไทย\n\n";
  prompt += "กฎ:\n";
  prompt += "1. เขียน 2 ย่อหน้า\n";
  prompt += "2. ย่อหน้าแรก: สรุปใจความสำคัญ แบบหนังสือพิมพ์ไทย กระชับ ชัดเจน\n";
  prompt += "3. ย่อหน้าที่สอง: วิเคราะห์ผลกระทบต่อเกษตรกรไทยหรือวงการไอที+เกษตร\n";
  prompt += "4. ใส่ emoji 2-3 ตัว\n";
  prompt += "5. ความยาวรวมไม่เกิน 100 คำ\n";
  prompt += "6. ห้ามใส่หัวข้อ เขียนเนื้อหาเลย\n\n";
  prompt += "Title: " + title + "\nDescription: " + (description || "");

  var resp = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + GEMINI_API_KEY,
    { contents: [{ parts: [{ text: prompt }] }] }
  );
  var article = resp.data.candidates[0].content.parts[0].text.trim();
  console.log("   บทความ:", article.substring(0, 80) + "...");
  return article;
}

async function createHeadline(title) {
  console.log("3. กำลังสร้างหัวข้อข่าว...");
  var prompt = "แปลหัวข้อข่าวนี้เป็นภาษาไทย สั้นกระชับ ไม่เกิน 10 คำ แบบพาดหัวหนังสือพิมพ์ ตอบเฉพาะหัวข้อ ห้ามใส่เครื่องหมายคำพูด\nTitle: " + title;
  var resp = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + GEMINI_API_KEY,
    { contents: [{ parts: [{ text: prompt }] }] }
  );
  var headline = resp.data.candidates[0].content.parts[0].text.trim();
  console.log("   หัวข้อ:", headline);
  return headline;
}

async function generateAndWaitImage() {
  console.log("4. กำลังสร้างภาพ...");
  var seed = Math.floor(Math.random() * 999999);
  var prompt = "smart farming drone rice field sensor Thailand newspaper photo";
  var url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=1024&height=1024&nologo=true&seed=" + seed;

  // รอให้ภาพสร้างเสร็จ
  console.log("   รอภาพสร้างเสร็จ...");
  var resp = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
  console.log("   ภาพสร้างเสร็จแล้ว ขนาด:", resp.data.length, "bytes");
  return url;
}

async function postToFacebook(article, headline, imageUrl, sourceUrl) {
  console.log("5. กำลังโพสต์ลง Facebook...");
  var message = "📰 " + headline + "\n\n";
  message += article + "\n\n";
  message += "🔗 อ่านข่าวต้นฉบับ: " + sourceUrl + "\n\n";
  message += "#ไอทีชาวสวน #AI #เกษตร #SmartFarming #เทคโนโลยีเกษตร #IoT #ข่าวเกษตร";

  var resp = await axios.post(
    "https://graph.facebook.com/v19.0/" + FB_PAGE_ID + "/photos",
    {
      url: imageUrl,
      caption: message,
      access_token: FB_PAGE_TOKEN,
    }
  );
  console.log("   โพสต์สำเร็จ! Post ID:", resp.data.id || resp.data.post_id);
  return resp.data;
}

async function main() {
  try {
    console.log("=== เริ่มระบบโพสต์อัตโนมัติ ===");
    console.log("เวลา:", new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }));
    console.log("");

    var news = await fetchNews();
    var article = await writeArticle(news.title, news.description);
    var headline = await createHeadline(news.title);
    var imageUrl = await generateAndWaitImage();
    await postToFacebook(article, headline, imageUrl, news.url);

    console.log("");
    console.log("=== สำเร็จทั้งหมด! ===");
  } catch (err) {
    console.error("ERROR:", err.response ? JSON.stringify(err.response.data) : err.message);
    process.exit(1);
  }
}

main();
