require 'open-uri'
require 'nokogiri'
require 'shellwords'
require 'json'

class ArticleScraperService
  def initialize(url)
    @url = url
  end

  def call
    parsed = parse_with_readability(@url)

    if parsed && parsed['error'].nil?
      Rails.logger.info("Readability succeeded")
      {
        headline: parsed['title']&.strip.presence,
        subheadline: parsed['subheadline']&.strip.presence,
        image_link: parsed['image_link']&.strip.presence,
        body: set_body_from_html(parsed['content'])
      }
    else
      Rails.logger.info("Readability failed, using Nokogiri fallback")
      html = URI.open(@url).read
      {
        headline: extract_headline(html),
        subheadline: extract_subheadline(html),
        image_link: extract_image_link(html),
        body: set_body_from_html(html)
      }
    end
  end

  private

  def parse_with_readability(url)
    script_path = Rails.root.join('lib', 'scripts', 'parse_article.js')
    result = `node #{script_path} #{Shellwords.escape(url)} 2>&1`
    JSON.parse(result)
  rescue JSON::ParserError, StandardError => e
    Rails.logger.error("Readability parsing failed: #{e.message}")
    nil
  end

  def extract_headline(html)
    doc = Nokogiri::HTML(html)
    doc.at('h1')&.text&.strip
  end

  def extract_subheadline(html)
    doc = Nokogiri::HTML(html)
    og_description = doc.at('meta[property="og:description"]')&.attr('content')
    twitter_description = doc.at('meta[name="twitter:description"]')&.attr('content')
    (og_description || twitter_description)&.strip.presence
  end

  def extract_image_link(html)
    doc = Nokogiri::HTML(html)
    og_image = doc.at('meta[property="og:image"]')&.attr('content')
    twitter_image = doc.at('meta[name="twitter:image"]')&.attr('content')
    (og_image || twitter_image)&.strip.presence
  end

  def set_body_from_html(html)
    doc = Nokogiri::HTML(html)
    article_tag = doc.at('article')
    paragraphs = article_tag ? article_tag.css('p') : doc.css('p')

    meaningful_paragraphs = paragraphs
      .map(&:text)
      .flat_map { |p| p.split(/\n+/) }
      .map(&:strip)
      .reject(&:empty?)

    meaningful_paragraphs.join("\n\n")
  end
end
