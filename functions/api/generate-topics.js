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
    return new Response(JSON.stringify({ status: 'ok', keyPrefix: (env.SILICONFLOW_KEY || 'NOT_SET').substring(0, 5) + '...' }), {
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
    const { type, seed, rssContent } = body;

    if (!env.SILICONFLOW_KEY) {
      throw new Error('Missing SILICONFLOW_KEY');
    }

    const systemPrompt = type === 'daily'
      ? '你是一个资深的写作导师，擅长根据新闻事件设计有思辨价值的写作题目。'
      : '你是一个创意写作引导师，专门提供生活观察类的微型写作灵感。';
    
    const userPrompt = type === 'daily' && rssContent
      ? `以下是今日重要新闻：\n${rssContent}\n\n请根据上述新闻设计1-3个写作题目，要求：\n1. 适合发表评论或感悟，要有讨论空间\n2. 避免敏感话题\n3. 题目简洁直接，每个不超过20字\n4. 输出格式：每行一个题目，不要编号`
      : `请为我生成1个“生活中的小事”写作题目，要求：\n1. 类似《642件可写的事》风格\n2. 简短有趣，能启发观察和记录\n3. 不超过15个字\n4. 只输出题目本身，不要任何解释`;

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
        temperature: 0.9,
        max_tokens: 200,
        seed,
      }),
    });

    const text = await apiResp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: '硅基流动返回非 JSON', 
        raw: text.substring(0, 300),
        status: apiResp.status 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!apiResp.ok || !data.choices || !data.choices[0]) {
      return new Response(JSON.stringify({ 
        error: 'API 调用失败或无 choices',
        siliconflowResponse: data,
        status: apiResp.status 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const content = data.choices[0].message?.content?.trim() || '';
    if (!content) {
      return new Response(JSON.stringify({ 
        error: '模型返回空内容',
        fullResponse: data 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let topics = content.split('\n').filter(t => t.length > 0).map(t => t.replace(/^\d+[\.\)]\s*/, ''));
    if (topics.length === 0) topics = [content];

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