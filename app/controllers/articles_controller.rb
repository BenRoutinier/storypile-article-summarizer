require 'open-uri'

class ArticlesController < ApplicationController
  before_action :set_article, only: [:card, :card_sm, :show, :destroy, :regenerate_summary, :archive, :favourite, :regenerate_summary, :update_summary_prompt, :update_tags]

  def index
    set_articles
  end

  def archived
    @articles = current_user.articles.where(archived: true).order(created_at: :desc)
  end

  def favourites
    @articles = current_user.articles.where(favourited: true).order(created_at: :desc)
  end

  def card
    #set_article
    # Renders just the article card partial for offline caching
    render partial: "articles/articlecard", locals: { article: @article }, layout: false
  end

  def card_sm
    render partial: "articles/articlecard_sm", locals: { article: @article }, layout: false
  end

  def show
    # set_article
  end

  def search
    search_params = params[:search] || {}

    @articles = current_user.articles

    if search_params[:query].present?
      @articles = @articles.search_fulltext(search_params[:query])
    end

    @articles = @articles
      .archived_status(search_params[:archived])
      .favourited_status(search_params[:favourited])
      .in_curation(search_params[:curation_id])
      .created_after(search_params[:created_after])
      .created_before(search_params[:created_before])
      .order(created_at: :desc)
  end

  def create
    @article = current_user.articles.build(article_params)

    if @article.save
      if params[:article][:curation_ids].present?
        params[:article][:curation_ids].each do |curation_id|
          Bookmark.create(
            article: @article,
            curation_id: curation_id
          )
        end
      end
      redirect_to article_path(@article)
    else
      set_articles
      render "articles/index", status: :unprocessable_entity
    end
  end

  def archive
    # set_article
    @article.update(archived: !@article.archived)
    redirect_back fallback_location: articles_path
  end

  def favourite
    # set_article
    @article.update(favourited: !@article.favourited)
    redirect_back fallback_location: articles_path
  end

  def regenerate_summary
    # set_article
    extra_instructions = params[:extra_instructions].to_s

    new_summary = @article.ai_summary(extra_instructions: extra_instructions)

    @article.update!(summary: new_summary)
    @article.reload
    render partial: "articles/summary", locals: { article: @article }
  end

  def update_tags
    # set_article
    @article.update!(tags: params[:tags])
    @article.reload
    render partial: "articles/tags", locals: { article: @article }
  end

  def update_summary_prompt
    # set_article
    @article.update!(summary_prompt_id: params[:summary_prompt_id])
    @article.reload
    render partial: "articles/summary", locals: { article: @article }
  end

  def destroy
    # set_article
    @article.destroy
    redirect_to articles_path, notice: "Article deleted"
  end

  private

  def set_articles
    @articles = current_user.articles.where(archived: false).order(created_at: :desc)
  end

  def set_article
    @article = current_user.articles.find(params[:id])
  end

  def article_params
    params.require(:article).permit(:link, :summary_prompt_id, :tags)
  end
end
