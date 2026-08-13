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
    const { article, topic } = await request.json();
    if (!article || article.trim().length < 10) {
      return new Response(JSON.stringify({ error: '文章太短，不需要评分啦' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!env.SILICONFLOW_KEY) {
      throw new Error('Missing SILICONFLOW_KEY');
    }

    const systemPrompt = '你是一位温和而专业的写作教练，善于发现文字中的闪光点，并给出建设性建议。请用鼓励的语气评价用户的文章，不要苛刻批评。';
    const userPrompt = `题目：${topic || '自由写作'}\n文章内容：\n${article}\n\n请对这篇文章给出简洁的评语（80字内），指出一个优点和一个可改进之处，语气温暖。`;

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
        max_tokens: 150,
      }),
    });

    const text = await apiResp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`硅基流动返回非 JSON: ${text.slice(0, 200)}`);
    }

    if (!apiResp.ok || !data.choices || !data.choices[0]) {
      throw new Error(`API 调用失败: ${JSON.stringify(data)}`);
    }

    const review = data.choices[0].message?.content?.trim() || '写得不错，继续加油！';

    return new Response(JSON.stringify({ review }), {
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