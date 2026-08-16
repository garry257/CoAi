const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const logger = require('../../utils/logger');

/**
 * Unescape basic HTML entities from titles and snippets.
 */
function unescapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x60;/g, '`')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Execute search query using DuckDuckGo HTML safely.
 * Returns up to 5 results.
 */
async function executeSearch(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    logger.info(`[SearchService] Executing query: "${query}"`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`DuckDuckGo responded with status ${res.status}`);
    }

    const html = await res.text();
    const results = [];
    
    // Split the HTML by result blocks
    const blocks = html.split(/class="result\s+results_links[^"]*"/);
    
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      
      // Find the main anchor link
      const titleMatch = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
      if (!titleMatch) continue;
      
      const rawUrl = titleMatch[1];
      const title = unescapeHtml(block.includes('result__a') ? titleMatch[2].replace(/<[^>]*>/g, '') : '');
      
      // Extract target URL from redirect
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
      
      // Skip DuckDuckGo internal URLs
      if (cleanUrl.includes('duckduckgo.com/') && !cleanUrl.includes('uddg=')) {
        continue;
      }
      
      // Extract snippet
      let snippet = '';
      const snippetMatch = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(block);
      if (snippetMatch) {
        snippet = unescapeHtml(snippetMatch[1].replace(/<[^>]*>/g, ''));
      }
      
      results.push({
        title: title || 'No Title',
        url: cleanUrl,
        snippet: snippet || 'No snippet available'
      });
      
      if (results.length >= 5) break;
    }
    
    logger.info(`[SearchService] Query "${query}" completed. Found ${results.length} results.`);
    return results;
  } catch (error) {
    logger.error(`[SearchService] Error searching for "${query}":`, error.message);
    return [];
  }
}

/**
 * Tool: Search for current interview trends, questions, and patterns for a given role or technology.
 */
async function searchInterviewTrends(query) {
  const fullQuery = `${query} interview trends questions patterns`;
  return executeSearch(fullQuery);
}

/**
 * Tool: Search for specific job descriptions, skill requirements, or qualifications for a role.
 */
async function searchJobRequirements(query) {
  const fullQuery = `${query} job requirements skills description`;
  return executeSearch(fullQuery);
}

/**
 * Tool: Search for company profiles, culture, recent news, or interview experiences.
 */
async function searchCompanyInformation(query) {
  const fullQuery = `${query} company profile culture news interview experience`;
  return executeSearch(fullQuery);
}

/**
 * Tool: Search for tutorials, documentation, courses, or guides to learn a technology.
 */
async function searchLearningResources(query) {
  const fullQuery = `${query} tutorials documentation courses guide learn`;
  return executeSearch(fullQuery);
}

module.exports = {
  searchInterviewTrends,
  searchJobRequirements,
  searchCompanyInformation,
  searchLearningResources
};
