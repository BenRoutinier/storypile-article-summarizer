class ProcessArticleJob < ApplicationJob
  queue_as :default

  def perform(article_id)
    article = Article.find_by(id: article_id)
    return unless article

    article.update!(status: :processing)

    begin
      scraped_data = ArticleScraperService.new(article.link).call

      # 1 - begin
      article.update!(
        headline: scraped_data[:headline],
        subheadline: scraped_data[:subheadline],
        image_link: scraped_data[:image_link],
        body: scraped_data[:body]
      )

      # 2 - summarize
      if article.body.present?
        summary = ArticleSummarizerService.new(article).call
        article.update!(summary: summary)
      end

      # 3. create the converation
      create_initial_conversation(article)

      article.update!(status: :completed)

    rescue StandardError => e
      Rails.logger.error("Article processing failed for Article ##{article.id}: #{e.message}")
      article.update!(status: :failed)
    end
  end

  private

  def create_initial_conversation(article)
    Conversation.create!(
      title: article.headline || "New Article",
      article: article
    )
  end
end
