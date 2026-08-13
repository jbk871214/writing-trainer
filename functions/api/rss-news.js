export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const rssUrl = 'http://www.people.com.cn/rss/politics.xml';
    const response = await fetch(rssUrl);
    const xml = await response.text();

    const items = [];
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const itemXml of itemMatches.slice(0, 5)) {
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
      if (titleMatch) {
        items.push({
          title: titleMatch[1],
          description: descMatch ? descMatch[1].replace(/\n/g, ' ').substring(0, 60) : ''
        });
      }
    }

    const rssContent = items.map(i => `- ${i.title}：${i.description}`).join('\n');

    return new Response(JSON.stringify({ status: 'ok', rssContent, items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'RSS抓取失败', detail: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}