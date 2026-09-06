const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;

// 1. ดึงข่าว (สุ่มจาก 5 ข่าวล่าสุด เพื่อไม่ซ้ำกันในแต่ละรอบ)
async function fetchNews() {
  console.log("1. กำลังดึงข่าว...");
  var res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "(agriculture OR farming OR smart farm) AND (technology OR AI OR IoT OR IT)",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 5,
      apiKey: NEWSAPI_KEY,
    },
  });
  if (!res.data.articles || !res.data.articles.length) {
    throw new Error("No news found");
  }
  // สุ่มเลือก 1 ข่าวจาก 5 ข่าวล่าสุด
  var index = Math.floor(Math.random() * Math.min(5, res.data.articles.length));
  var article = res.data.articles[index];
  console.log("   ข่าว:", article.title);
  return article;
}

// 2. เขียนบทความข่าว 2 ย่อหน้า ด้วย Gemini
async function writeArticle(title, description) {
  console.log("2. กำลังเขียนบทความข่าว (Gemini)...");
  var prompt = "คุณเป็นนักข่าวสายเทคโนโลยีการเกษตรของไทย เขียนบทความข่าวภาษาไทยจากข่าวต่อไปนี้\n\n";
  prompt += "กฎ:\n";
  prompt += "1. เขียนเป็น 2 ย่อหน้า\n";
  prompt += "2. ย่อหน้าแรก: สรุปใจความสำคัญของข่าว เขียนแบบหนังสือพิมพ์ไทย กระชับ ชัดเจน\n";
  prompt += "3. ย่อหน้าที่สอง: วิเคราะห์ผลกระทบต่อเกษตรกรไทยหรือวงการไอที+เกษตร\n";
  prompt += "4. ใส่ emoji ที่เหมาะสม 2-3 ตัว\n";
  prompt += "5. ความยาวรวมไม่เกิน 100 คำ\n";
  prompt += "6. ห้ามใส่หัวข้อหรือชื่อเรื่อง เขียนเนื้อหาเลย\n\n";
  prompt += "Title: " + title + "\n";
  prompt += "Description: " + (description || "");

  var resp = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + GEMINI_API_KEY,
    {
      contents: [{ parts: [{ text: prompt }] }],
    }
  );
  var article = resp.data.candidates[0].content.parts[0].text.trim();
  console.log("   บทความ:", article.substring(0, 80) + "...");
  return article;
}

// 3. สร้างหัวข้อข่าวภาษาไทย (สำหรับใส่ในภาพ)
async function createHeadline(title) {
  console.log("3. กำลังสร้างหัวข้อข่าวภาษาไทย...");
  var prompt = "แปลหัวข้อข่าวนี้เป็นภาษาไทย สั้นๆ กระชับ ไม่เกิน 12 คำ เหมาะสำหรับพาดหัวหนังสือพิมพ์ ห้ามใส่เครื่องหมายคำพูด\nTitle: " + title;

  var resp = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + GEMINI_API_KEY,
    {
      contents: [{ parts: [{ text: prompt }] }],
    }
  );
  var headline = resp.data.candidates[0].content.parts[0].text.trim();
  console.log("   หัวข้อ:", headline);
  return headline;
}

// 4. สร้างภาพแบบหนังสือพิมพ์ไทย (Pollinations.ai)
function generateImageUrl(headline) {
  console.log("4. กำลังสร้างภาพแบบหนังสือพิมพ์...");
  var prompt = "Thai newspaper front page layout, headline news about agriculture technology and AI, professional newspaper design with Thai text, clean typography, newspaper column layout, realistic newspaper photo of smart farming, drone spraying rice field, sensor in farm, modern agriculture, photorealistic style, high quality press photo, newspaper masthead design";
  var encoded = encodeURIComponent(prompt);
  var url = "https://image.pollinations.ai/prompt/" + encoded + "?width=1024&height=1024&nologo=true&seed=" + Date.now();
  console.log("   ภาพ URL พร้อมแล้ว");
  return url;
}

// 5. โพสต์ลง Facebook
async function postToFacebook(article, headline, imageUrl, sourceUrl) {
  console.log("5. กำลังโพสต์ลง Facebook...");
  var message = "📰 " + headline + "\n\n";
  message += article + "\n\n";
  message += "🔗 อ่านข่าวต้นฉบับ: " + sourceUrl + "\n\n";
  message += "#ไอทีชาวสวน #AI #เกษตร #SmartFarming #เทคโนโลยีเกษตร #IoT #ข่าวเกษตร #นวัตกรรมเกษตร";

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

// รันทั้งหมด
async function main() {
  try {
    var now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    console.log("=== เริ่มระบบโพสต์อัตโนมัติ ===");
    console.log("เวลา:", now);
    console.log("");

    var news = await fetchNews();
    var article = await writeArticle(news.title, news.description);
    var headline = await createHeadline(news.title);
    var imageUrl = generateImageUrl(headline);
    await postToFacebook(article, headline, imageUrl, news.url);

    console.log("");
    console.log("=== สำเร็จทั้งหมด! ===");
  } catch (err) {
    console.error("ERROR:", err.response ? JSON.stringify(err.response.data) : err.message);
    process.exit(1);
  }
}

main();
