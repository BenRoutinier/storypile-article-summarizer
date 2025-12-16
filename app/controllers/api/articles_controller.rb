module Api
  class ArticlesController < ApplicationController
    before_action :authenticate_user!
    before_action :set_article, only: [:show]

    # GET /api/articles
    # Returns all articles for offline sync
    # Optional: ?updated_since=ISO8601_timestamp for incremental sync
    def index
      @articles = current_user.articles

      if params[:updated_since].present?
        timestamp = Time.zone.parse(params[:updated_since])
        @articles = @articles.where("updated_at > ?", timestamp)
      end

      render json: @articles.map { |article| article_json(article) }
    end

    # GET /api/articles/:id
    def show
      render json: article_json(@article)
    end

    private

    def set_article
      @article = current_user.articles.find(params[:id])
    end

    def article_json(article)
      {
        id: article.id,
        headline: article.headline,
        subheadline: article.subheadline,
        body: article.body,
        summary: article.summary,
        image_link: article.image_link,
        tags: article.tags,
        link: article.link,
        created_at: article.created_at.iso8601,
        updated_at: article.updated_at.iso8601,
        favourited: article.favourited,
        archived: article.archived
      }
    end
  end
end
