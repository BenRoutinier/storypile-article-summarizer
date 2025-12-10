require 'nokogiri'

class Article < ApplicationRecord
  include PgSearch::Model

  belongs_to :user
  belongs_to :summary_prompt, optional: true
  has_many :conversations, dependent: :destroy
  has_many :bookmarks, dependent: :destroy
  has_many :curations, through: :bookmarks

  attr_accessor :curation_id

  validates :link,
            presence: true,
            uniqueness: { scope: :user_id },
            format: {
              with: URI::DEFAULT_PARSER.make_regexp(%w[http https]),
              message: "must be a valid URL"
            }

  before_validation :populate_from_link, on: :create
  after_create :create_initial_conversation

  pg_search_scope :search_fulltext,
                  against: [:headline, :subheadline, :body, :summary, :tags],
                  using: {
                    tsearch: { prefix: true }
                  }

  scope :archived_status, ->(status) {
    return all if status.blank?
    where(archived: status == 'true')
  }

  scope :favourited_status, ->(status) {
    return all if status.blank?
    where(favourited: status == 'true')
  }

  scope :in_curation, ->(curation_id) {
    return all if curation_id.blank?
    joins(:bookmarks).where(bookmarks: { curation_id: curation_id })
  }

  scope :created_after, ->(date) {
    return all if date.blank?
    where('created_at >= ?', date)
  }

  scope :created_before, ->(date) {
    return all if date.blank?
    where('created_at <= ?', date)
  }

  def ai_summary(extra_instructions: "")
    ai_prompt = <<~PROMPT
      You are a professional media office assistant creating a news overview
      for an exclusive client. Summarize the most important parts of the
      following text for the client. Create a nutgraf in the style of the
      associated press giving an overview of the whole story. Return the
      text of your summary with no subheadings.
      CORE RULES
      You MUST use only information explicitly present in the article.
      You MUST NOT use external knowledge.
      You MUST NOT guess.
      You MUST NOT interpret, speculate, or provide opinions.
    PROMPT

    prompt = <<~FINALPROMPT
      #{ai_prompt}

      #{self.summary_prompt_id ? "Also follow these custom instructions: #{SummaryPrompt.find(self.summary_prompt_id).content}" : ''}

      #{extra_instructions.present? ? "Additional one-time instructions: #{extra_instructions}" : ''}
    FINALPROMPT

    begin
      response = RubyLLM.chat.with_instructions(prompt).ask(self.body).content

      if response.blank?
        return "Summary could not be generated at this time."
      end

      response
    rescue StandardError
      "Summary could not be generated at this time."
    end
  end

  private

  def populate_from_link
    return if link.blank?

    parsed = parse_with_readability(link)

    if parsed && parsed['error'].nil?
      self.headline = parsed['title']&.strip.presence
      self.subheadline = parsed['subheadline']&.strip.presence
      self.image_link = parsed['image_link']&.strip.presence
      self.body = set_body_from_html(parsed['content'])
      Rails.logger.info("Readability succeeded")
    else
      Rails.logger.info("Readability failed, using Nokogiri fallback")
      html = URI.open(link).read
      set_headline_from_html(html)
      set_subheadline_from_html(html)
      set_image_link_from_html(html)
      set_body_from_html(html)
    end

    self.summary = ai_summary
  end

  def parse_with_readability(url)
    script_path = Rails.root.join('lib', 'scripts', 'parse_article.js')
    result = `node #{script_path} #{Shellwords.escape(url)} 2>&1`
    JSON.parse(result)
  rescue JSON::ParserError, StandardError => e
    Rails.logger.error("Readability parsing failed: #{e.message}")
    nil
  end

  def create_initial_conversation
    Conversation.create!(
      title: headline,
      article: self
    )
  end

  def set_headline_from_html(html)
    doc = Nokogiri::HTML(html)

    h1 = doc.at('h1')

    self.headline = h1.text.strip if h1
  end

  def set_body_from_html(html)
    doc = Nokogiri::HTML(html)

    article_tag = doc.at('article')
    paragraphs = if article_tag
                   article_tag.css('p')
                 else
                   doc.css('p')
                 end

    meaningful_paragraphs = paragraphs.map(&:text).map(&:strip).select { |p| p.match?(/[.?!]/) }

    self.body = meaningful_paragraphs.join("\n\n")
  end

  def set_subheadline_from_html(html)
    doc = Nokogiri::HTML(html)

    og_description = doc.at('meta[property="og:description"]')&.attr('content')
    twitter_description = doc.at('meta[name="twitter:description"]')&.attr('content')

    self.subheadline = (og_description || twitter_description)&.strip.presence
  end

  def set_image_link_from_html(html)
    doc = Nokogiri::HTML(html)

    og_image = doc.at('meta[property="og:image"]')&.attr('content')
    twitter_image = doc.at('meta[name="twitter:image"]')&.attr('content')

    self.image_link = (og_image || twitter_image)&.strip.presence
  end
end
