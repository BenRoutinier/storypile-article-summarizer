const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

const url = process.argv[2];

async function parseArticle(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();

    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    const ogDescription = document.querySelector('meta[property="og:description"]')?.content || null;
    const twitterDescription = document.querySelector('meta[name="twitter:description"]')?.content || null;
    const ogImage = document.querySelector('meta[property="og:image"]')?.content || null;
    const twitterImage = document.querySelector('meta[name="twitter:image"]')?.content || null;

    const reader = new Readability(document);
    const article = reader.parse();

    const result = {
      title: article?.title || null,
      byline: article?.byline || null,
      content: article?.content || null,
      excerpt: article?.excerpt || null,
      siteName: article?.siteName || null,
      subheadline: ogDescription || twitterDescription || article?.excerpt || null,
      image_link: ogImage || twitterImage || null
    };

    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

parseArticle(url);
