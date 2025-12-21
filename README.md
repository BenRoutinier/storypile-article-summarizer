# Storypile - Article Summarizer & Curator

Storypile is a Ruby on Rails application that allows users to save articles from the web, automatically extracts their content using a Node.js script, and generates concise summaries using an LLM (Large Language Model). It features a clean UI for reading, organizing, and chatting with your articles.

## Features

- **Save Links**: Paste a URL, and Storypile extracts the content (headline, body, image).
- **AI Summaries**:  Automatically generates summaries using `RubyLLM` (requires an LLM provider key).
- **Chat with Articles**:  Ask questions about the saved articles.
- **Organization**:  Tag articles, add them to "Curations" (collections), and bookmark favorites.
- **Responsive Design**:  Mobile-first UI with PWA support.
- **Search**: Full-text search across headlines, summaries, and tags.

## Architecture

- **Backend**: Ruby on Rails 7.1, PostgreSQL.
- **Frontend**: Hotwire (Turbo & Stimulus), Bootstrap 5.3, Sass.
- **Scraping**: Node.js script (`readability`) invoked by Rails for robust content extraction. Fallback to Nokogiri.
- **AI**: `ruby_llm` gem connecting to LLM providers.

## Getting Started

### Prerequisites

- Ruby 3.3.5
- Node.js (Required for the scraping script)
- PostgreSQL
- Redis (Optional, recommended for Action Cable/Jobs in production)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd storypile-article-summarizer
    ```

2.  **Install Ruby dependencies:**
    ```bash
    bundle install
    ```

3.  **Install Node dependencies:**
    ```bash
    # Ensures packages for the scraping script are installed
    npm install
    ```

4.  **Database Setup:**
    ```bash
    rails db:create db:migrate
    ```

5.  **Environment Variables:**
    Create a `.env` file in the root directory and add your keys:
    ```
    OPENAI_API_KEY=your_api_key_here
    ```

6.  **Run the application:**
    ```bash
    rails server
    ```
    Visit `http://localhost:3000` in your browser.

## Key Components

- **App Models**: `Article` is the core model performing most heavy lifting (scraping/summarizing).
- **Scripts**: `lib/scripts/parse_article.js` uses `@mozilla/readability` and `jsdom` to parse web pages.
