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
}