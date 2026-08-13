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

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'daily' && rssContent) {
      systemPrompt = '你是一个资深语文教师，擅长设计中学生写作训练题目。你只会严格按照指定格式输出，绝不输出任何多余内容。';
      userPrompt = `以下是今日新闻摘要：\n${rssContent}\n\n请根据以上素材，设计三个作文题目，要求：
1. 第一个是命题作文：直接写题目，如《那一刻，我长大了》，不要加任何前缀。
2. 第二个是材料作文：先写“材料：”后面接一段简短情境或故事（不超过40字），然后换行写“要求：请结合材料，自拟题目，写一篇短文，可叙事、可议论、可抒情。”
3. 第三个是半命题作文：只写带有“____”的半截题目，如“____的力量”。
三个题目之间必须用三个竖线“|||”分隔。不要输出任何其他解释、问候或编号。
${excludeTopics && excludeTopics.length ? `避免与以下题目重复：${excludeTopics.join('、')}` : ''}`;
    } else if (type === 'small-things') {
      systemPrompt = '你是一个创意写作引导师，只输出一个生活中的小事题目，不超过15字，不带任何解释。';
      userPrompt = `${excludeTopics && excludeTopics.length ? `避免与以下题目重复：${excludeTopics.join('、')}` : ''}`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const apiResp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
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
        temperature: 0.7,
        max_tokens: 400,
        seed,
      }),
    });

    const text = await apiResp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return new Response(JSON.stringify({ error: '硅基流动返回非 JSON', raw: text.substring(0, 300) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!apiResp.ok || !data.choices || !data.choices[0]) {
      return new Response(JSON.stringify({ error: 'API 调用失败', detail: data }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const content = data.choices[0].message?.content?.trim() || '';
    if (!content) {
      return new Response(JSON.stringify({ error: '模型返回空内容' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let topics;
    if (type === 'daily') {
      // 按 ||| 分隔
      topics = content.split('|||').map(t => t.trim()).filter(t => t.length > 0);
      // 清理行首可能的数字编号
      topics = topics.map(t => t.replace(/^\d+[\.\)]\s*/, '').trim());
      // 确保有三个
      while (topics.length < 3) topics.push('自由写作');
      topics = topics.slice(0, 3);
    } else {
      topics = [content.trim().replace(/^\d+[\.\)]\s*/, '')];
    }

    return new Response(JSON.stringify({ topics }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}