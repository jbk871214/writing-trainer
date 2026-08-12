const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V2.5';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { article, topic } = req.body;

  if (!article || article.trim().length < 10) {
    return res.status(400).json({ error: '文章太短，不需要评分啦' });
  }

  try {
    const systemPrompt = '你是一位温和而专业的写作教练，善于发现文字中的闪光点，并给出建设性建议。请用鼓励的语气评价用户的文章，不要苛刻批评。';
    const userPrompt = `题目：${topic || '自由写作'}\n文章内容：\n${article}\n\n请对这篇文章给出简洁的评语（80字内），指出一个优点和一个可改进之处，语气温暖。`;

    const response = await fetch(SILICONFLOW_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SILICONFLOW_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const data = await response.json();
    const review = data.choices[0].message.content.trim();

    res.status(200).json({ review });
  } catch (error) {
    console.error('评分失败:', error);
    res.status(500).json({ error: '评分服务暂时不可用' });
  }
}