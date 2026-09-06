const axios = require("axios");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;

async function fetchNews() {
  console.log("1. กำลังดึงข่าว...");
  var res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "agriculture AND technology",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 1,
      apiKey: NEWSAPI_KEY,
    },
  });
  if (!res.data.articles || !res.data.articles.length) {
    throw new Error("No news found");
  }
  console.log("   ข่าว:", res.data.articles[0].title);
  return res.data.articles[0];
}

async function summarize(title, description) {
  console.log("2. กำลังสรุปข่าว...");
  var resp = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "สรุปข่าวนี้เป็นภาษาไทย สั้นๆ ไม่เกิน 20 คำ เหมาะสำหรับโพสต์ Facebook พร้อมใส่ emoji\nTitle: " + title + "\nDescription: " + (description || ""),
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    },
    { headers: { Authorization: "Bearer " + OPENAI_API_KEY } }
  );
  var caption = resp.data.choices[0].message.content.trim();
  console.log("   แคปชั่น:", caption);
  return caption;
}

async function generateImage(caption) {
  console.log("3. กำลังสร้างภาพ...");
  var resp = await axios.post(
    "https://api.openai.com/v1/images/generations",
    {
      model: "dall-e-3",
      prompt: "Create a bright colorful modern infographic about AI and smart farming technology. Style: clean, professional, Thai agriculture theme. Caption: " + caption,
      n: 1,
      size: "1024x1024",
    },
    { headers: { Authorization: "Bearer " + OPENAI_API_KEY } }
  );
  console.log("   ภาพสร้างแล้ว");
  return resp.data.data[0].url;
}

async function postToFacebook(caption, imageUrl, sourceUrl) {
  console.log("4. กำลังโพสต์ลง Facebook...");
  var message = caption + "\n\nอ่านเพิ่มเติม: " + sourceUrl + "\n\n#AI #เกษตร #SmartFarming #เทคโนโลยีเกษตร";
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
    var caption = await summarize(news.title, news.description);
    var imageUrl = await generateImage(caption);
    await postToFacebook(caption, imageUrl, news.url);
    console.log("");
    console.log("=== สำเร็จทั้งหมด! ===");
  } catch (err) {
    console.error("ERROR:", err.response ? JSON.stringify(err.response.data) : err.message);
    process.exit(1);
  }
}

main();
