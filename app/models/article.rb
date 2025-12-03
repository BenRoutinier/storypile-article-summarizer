require 'nokogiri'

class Article < ApplicationRecord
  belongs_to :user
  belongs_to :summary_prompt, optional: true
  has_many :conversations, dependent: :destroy
  validates :link,
            presence: true,
            uniqueness: { scope: :user_id },
            format: {
              with: URI::DEFAULT_PARSER.make_regexp(%w[http https]),
              message: "must be a valid URL"
            }

  before_validation :populate_from_link, on: :create
  after_create :create_initial_conversation

  private

  def populate_from_link
    return if link.blank?

    html = URI.open(link).read
    set_headline_from_html(html)
    set_body_from_html(html)
    self.summary = ai_summary
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

    meaningful_paragraphs = paragraphs.map(&:text).map(&:strip).select { |p| p.length > 40 }

    self.body = meaningful_paragraphs.join("\n\n")
  end

  def ai_summary
    summary_prompt = <<-PROMPT
      You are a professional media office assistant creating a news overview
      for an exclusive client. Summarize the most important parts of the
      following text for the client. Create a nutgraf in the style of the
      associated press giving an overview of the whole story. Return the
      text of your summary with no subheadings.
    PROMPT
    prompt = "#{summary_prompt} #{self.summary_prompt_id ? "Also follow these custom instructions: #{SummaryPrompt.find(self.summary_prompt_id).content}" : ''}"
    RubyLLM.chat.with_instructions(prompt).ask(self.body).content
  end
end
