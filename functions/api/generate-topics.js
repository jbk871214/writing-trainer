const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V2.5';

export async function onRequest(context) {
  const { request, env } = context;

  // 统一设置 CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // 处理 CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // 测试：GET 请求返回简单信息
  if (request.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', message: 'generate-topics function is running' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 正常的 POST 逻辑
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const body = await request.json();
    const { type, seed, rssContent } = body;
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'daily' && rssContent) {
      systemPrompt = '你是一个资深的写作导师，擅长根据新闻事件设计有思辨价值的写作题目。';
      userPrompt = `以下是今日重要新闻：\n${rssContent}\n\n请根据上述新闻设计1-3个写作题目，要求：\n1. 适合发表评论或感悟，要有讨论空间\n2. 避免敏感话题\n3. 题目简洁直接，每个不超过20字\n4. 输出格式：每行一个题目，不要编号`;
    } else if (type === 'small-things') {
      systemPrompt = '你是一个创意写作引导师，专门提供生活观察类的微型写作灵感。';
      userPrompt = `请为我生成1个“生活中的小事”写作题目，要求：\n1. 类似《642件可写的事》风格\n2. 简短有趣，能启发观察和记录\n3. 不超过15个字\n4. 只输出题目本身，不要任何解释`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const apiResponse = await fetch(SILICONFLOW_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SILICONFLOW_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 200,
        seed: seed,
      }),
    });

    const data = await apiResponse.json();
    const content = data.choices[0].message.content.trim();
    let topics = content.split('\n').filter(t => t.length > 0).map(t => t.replace(/^\d+[\.\)]\s*/, ''));
    if (topics.length === 0) topics = [content];

    return new Response(JSON.stringify({ topics }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: '生成失败，请稍后再试' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}