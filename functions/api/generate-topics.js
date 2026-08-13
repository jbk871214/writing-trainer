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

    let systemPrompt = '你是一个资深语文教师，擅长设计贴近中学生生活的作文题目，题目要求具体、有画面感、避免空泛宏大。';
    let userPrompt = '';

    if (type === 'daily' && rssContent) {
      systemPrompt += '你可以结合近期新闻，但题目仍要落脚于个人体验与日常观察。';
      userPrompt = `以下是今日新闻摘要：\n${rssContent}\n\n请根据以上素材，设计三个作文题目，要求：
1. 第一个为命题作文式：直接给出具体题目，如《那一刻，我长大了》《窗外的风景》，不超过15字。
2. 第二个为材料作文式：给出一段简短材料或情境描述（不超过40字），然后要求围绕材料自拟题目写作。
3. 第三个为半命题式：题目留空，如《____的力量》《原来，____》，要求补全后写作。
4. 三个题目风格贴近中学生的日常生活和成长感悟，避免政治、宏大叙事。
5. 输出格式：每行一个题目，不写编号，不写类型标签，第一个是命题，第二个是材料（材料后面用“//”分隔题目要求），第三个是半命题（直接写题目，留空用“____”表示）。
${excludeTopics && excludeTopics.length ? `6. 避免与以下题目重复：${excludeTopics.join('、')}` : ''}`;
    } else if (type === 'small-things') {
      systemPrompt = '你是一个创意写作引导师，专门提供生活观察类的微型写作灵感。';
      userPrompt = `请为我生成1个“生活中的小事”写作题目，要求：
1. 类似《642件可写的事》风格
2. 简短有趣，能启发观察和记录
3. 不超过15个字
4. 只输出题目本身，不要任何解释
${excludeTopics && excludeTopics.length ? `5. 避免与以下题目重复：${excludeTopics.join('、')}` : ''}`;
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
        temperature: 0.9,
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

    let topics = content.split('\n').filter(t => t.trim().length > 0);
    topics = topics.map(t => t.trim());
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