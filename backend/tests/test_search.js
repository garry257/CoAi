const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function testSearch() {
  const query = 'Node.js developer interview trends 2026';
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  try {
    console.log('Fetching:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML Length:', html.length);
    
    // Regex to match result__a links
    const results = [];
    const titleRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = titleRegex.exec(html)) !== null && results.length < 10) {
      let rawUrl = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      
      // Extract the actual target URL from DuckDuckGo's redirect URL
      let cleanUrl = rawUrl;
      if (rawUrl.includes('uddg=')) {
        const parts = rawUrl.split('uddg=');
        if (parts.length > 1) {
          const rawTarget = parts[1].split('&')[0];
          cleanUrl = decodeURIComponent(rawTarget);
        }
      } else if (rawUrl.startsWith('//')) {
        cleanUrl = 'https:' + rawUrl;
      }
      
      results.push({ title, url: cleanUrl });
    }
    console.log('Parsed Search Results:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error during search test:', err);
  }
}

testSearch();
