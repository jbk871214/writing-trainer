export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const body = await request.json();
    const { type, seed, rssContent, excludeTopics } = body;

    if (!env.SILICONFLOW_KEY) {
      throw new Error('Missing SILICONFLOW_KEY');
    }

    // 清理函数：去除乱码和多余空白
    const cleanText = (text) => {
      if (!text) return '';
      let cleaned = text.trim();
      // 如果包含连续重复字符（如 kuk kuk kuk），判定为乱码
      const repeatPattern = /(.)\1{4,}/; // 连续5个相同字符
      if (repeatPattern.test(cleaned)) {
        return '';
      }
      // 去除首尾无关的引号或标点
      cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, '');
      return cleaned;
    };

    const fallbackTopics = [
      '那一刻，我长大了',
      '材料：窗外的树在风中摇晃，一片叶子缓缓落下。 要求：请结合材料，自拟题目，写一篇短文，可叙事、可议论、可抒情。',
      '____的力量'
    ];

    const callAi = async (systemPrompt, userPrompt, fallback, seedOffset = 0) => {
      // 每次调用使用不同的 seed，避免重复
      const currentSeed = (seed || 0) + seedOffset + Math.floor(Math.random() * 1000);
      const resp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SILICONFLOW_KEY}`,
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-7B-Instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2, // 极低温度，提高稳定性
          max_tokens: 200,
          seed: currentSeed,
        }),
      });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return fallback;
      }

      if (!resp.ok || !data.choices || !data.choices[0]) {
        return fallback;
      }

      const raw = data.choices[0].message?.content?.trim() || '';
      const cleaned = cleanText(raw);
      // 如果清理后为空，返回兜底
      return cleaned || fallback;
    };

    if (type === 'daily' && rssContent) {
      const excludeStr = excludeTopics && excludeTopics.length
        ? `避免与以下题目重复：${excludeTopics.join('、')}`
        : '';

      // 1. 命题作文
      const topic1 = await callAi(
        '你是资深语文教师，只输出一个具体的命题作文题目。不要任何解释、编号、引号或前缀。',
        `请根据以下新闻素材设计一个命题作文题目，题目要贴近中学生日常，不超过15字。\n${rssContent}\n${excludeStr}`,
        fallbackTopics[0],
        0
      );

      // 2. 材料作文（强化要求必须包含“材料：”）
      const topic2 = await callAi(
        '你是资深语文教师，只输出材料作文题目。格式必须严格为：材料：<简短情境> 要求：请结合材料，自拟题目，写一篇短文，可叙事、可议论、可抒情。不要输出任何其他内容。',
        `请根据以下新闻素材设计一个材料作文，材料部分不超过40字，要求部分必须完全按照格式。\n${rssContent}\n${excludeStr}`,
        fallbackTopics[1],
        1
      );
      // 后处理：如果材料作文缺少“材料：”，自动补全
      let finalTopic2 = topic2;
      if (!finalTopic2.startsWith('材料：')) {
        finalTopic2 = '材料：' + finalTopic2;
      }
      if (!finalTopic2.includes('要求：')) {
        finalTopic2 += ' 要求：请结合材料，自拟题目，写一篇短文，可叙事、可议论、可抒情。';
      }

      // 3. 半命题作文
      const topic3 = await callAi(
        '你是资深语文教师，只输出一个半命题作文题目，必须包含两个下划线“____”。不要任何解释、编号或前缀。',
        `请设计一个半命题作文题目，贴近中学生日常，如“____的力量”。\n${excludeStr}`,
        fallbackTopics[2],
        2
      );

      return new Response(JSON.stringify({ topics: [topic1, finalTopic2, topic3] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } else if (type === 'small-things') {
      const topic = await callAi(
        '你是创意写作引导师，只输出一个生活中的小事题目，不超过15字。不要任何解释。',
        `${excludeTopics && excludeTopics.length ? `避免与以下题目重复：${excludeTopics.join('、')}` : ''}`,
        '写下今天最安静的时刻',
        3
      );
      return new Response(JSON.stringify({ topics: [topic] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}