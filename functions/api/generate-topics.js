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

    const callAi = async (systemPrompt, userPrompt) => {
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
          temperature: 0.3, // 降低温度，提高稳定性
          max_tokens: 150,
          seed,
        }),
      });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('硅基流动返回非 JSON');
      }

      if (!resp.ok || !data.choices || !data.choices[0]) {
        throw new Error(data.message || 'API 调用失败');
      }

      return data.choices[0].message?.content?.trim() || '';
    };

    if (type === 'daily' && rssContent) {
      const excludeStr = excludeTopics && excludeTopics.length
        ? `避免与以下题目重复：${excludeTopics.join('、')}`
        : '';

      // 1. 命题作文
      const topic1 = await callAi(
        '你是资深语文教师，只输出一个具体的命题作文题目。不要任何解释、编号、引号或前缀。',
        `请根据以下新闻素材设计一个命题作文题目，题目要贴近中学生日常，不超过15字。\n${rssContent}\n${excludeStr}`
      ).catch(() => '那一刻，我长大了');

      // 2. 材料作文
      const topic2 = await callAi(
        '你是资深语文教师，只输出材料作文。格式必须为：材料：<简短情境> 要求：请结合材料，自拟题目，写一篇短文，可叙事、可议论、可抒情。不要任何额外内容。',
        `请根据以下新闻素材设计一个材料作文。材料不超过40字，要求部分固定。\n${rssContent}\n${excludeStr}`
      ).catch(() => '材料：生活中的小事 要求：请结合材料，自拟题目，写一篇短文，可叙事、可议论、可抒情。');

      // 3. 半命题作文
      const topic3 = await callAi(
        '你是资深语文教师，只输出一个半命题作文题目，必须包含两个下划线“____”。不要任何解释、编号或前缀。',
        `请设计一个半命题作文题目，贴近中学生日常，如“____的力量”。\n${excludeStr}`
      ).catch(() => '____的力量');

      return new Response(JSON.stringify({ topics: [topic1, topic2, topic3] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } else if (type === 'small-things') {
      const topic = await callAi(
        '你是创意写作引导师，只输出一个生活中的小事题目，不超过15字。不要任何解释。',
        `${excludeTopics && excludeTopics.length ? `避免与以下题目重复：${excludeTopics.join('、')}` : ''}`
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