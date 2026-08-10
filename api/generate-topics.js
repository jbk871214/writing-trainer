// 硅基流动 API 调用封装
const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V2.5'; // 可替换为你喜欢的模型

export default async function handler(req, res) {
  // 处理 CORS 预检
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, seed, rssContent } = req.body; // type: 'daily' | 'small-things'
  
  try {
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'daily' && rssContent) {
      systemPrompt = '你是一个资深的写作导师，擅长根据新闻事件设计有思辨价值的写作题目。';
      userPrompt = `以下是今日重要新闻：\n${rssContent}\n\n请根据上述新闻设计1-3个写作题目，要求：\n1. 适合发表评论或感悟，要有讨论空间\n2. 避免敏感话题\n3. 题目简洁直接，每个不超过20字\n4. 输出格式：每行一个题目，不要编号`;
    } else if (type === 'small-things') {
      systemPrompt = '你是一个创意写作引导师，专门提供生活观察类的微型写作灵感。';
      userPrompt = `请为我生成1个“生活中的小事”写作题目，要求：\n1. 类似《642件可写的事》风格\n2. 简短有趣，能启发观察和记录\n3. 不超过15个字\n4. 只输出题目本身，不要任何解释`;
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // 调用硅基流动
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
        temperature: 0.9,
        max_tokens: 200,
        seed: seed // 传入种子保证千人千面
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // 题目拆分
    let topics = content.split('\n').filter(t => t.length > 0).map(t => t.replace(/^\d+[\.\)]\s*/, ''));
    if (topics.length === 0) topics = [content]; // 兜底

    res.status(200).json({ topics });
  } catch (error) {
    console.error('生成话题失败:', error);
    res.status(500).json({ error: '生成失败，请稍后再试' });
  }
}