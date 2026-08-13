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
      systemPrompt = '你是一个资深语文教师，擅长设计中学生日常写作训练题目。你只会严格按格式输出题目，绝不输出任何多余内容。';
      userPrompt = `以下是今日新闻摘要：\n${rssContent}\n\n请根据以上素材，设计三个作文题目，要求：
1. 第一行：命题作文，只写题目，不加任何前缀或引号，如《那一刻，我长大了》。
2. 第二行：材料作文，格式为“材料：<简短情境或故事> 要求：请结合材料，自拟题目，写一篇短文，可叙事、可议论、可抒情。”
3. 第三行：半命题作文，只写带有“____”的半截题目，如“____的力量”。
不要输出任何解释、问候、编号或其他内容。
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
        max_tokens: 300,
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

    let topics = content.split('\n').map(t => t.trim()).filter(t => t.length > 0);

    // 对于 daily 类型，需要三个题目；如果不是三个，尝试重试一次（这里不实现重试，直接返回现有内容）
    if (type === 'daily' && topics.length < 3) {
      // 如果不足三个，补占位
      while (topics.length < 3) topics.push('自由写作');
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