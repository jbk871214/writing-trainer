<<<<<<< HEAD
import Parser from 'rss-parser';

const parser = new Parser();

export default async function handler(req, res) {
  try {
    // 人民网要闻RSS
    const feed = await parser.parseURL('http://www.people.com.cn/rss/politics.xml');
    // 只取最新5条，每条标题+描述
    const items = feed.items.slice(0, 5).map(item => ({
      title: item.title,
      description: item.contentSnippet || item.content || ''
    }));
    
    // 拼接成字符串
    const rssContent = items.map(i => `- ${i.title}：${i.description.replace(/\n/g, ' ').substring(0, 60)}`).join('\n');
    
    res.status(200).json({ rssContent, items });
  } catch (error) {
    console.error('RSS抓取失败:', error);
    // 失败时返回空，前端会使用缓存或历史内容
    res.status(200).json({ rssContent: '', items: [] });
  }
=======
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

    // 简陋解析
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

    return new Response(JSON.stringify({ 
      status: 'ok',
      rssContent, 
      items 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'RSS抓取失败', 
      detail: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
>>>>>>> dcc9eac8fea66363ba992556d39d2356a8c849f0
}