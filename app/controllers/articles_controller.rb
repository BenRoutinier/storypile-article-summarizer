require 'open-uri'

class ArticlesController < ApplicationController
  before_action :set_article, only: [:show, :destroy, :regenerate_summary]

  def index
    @articles = current_user.articles.order(created_at: :desc)
  end

  def show
    #set_article
  end

  def create
    @article = current_user.articles.build(article_params)

    if @article.save
      redirect_to conversation_path(@article.conversations.first)
    else
      @articles = current_user.articles.all
      render "articles/index", status: :unprocessable_entity
    end
  end

  def regenerate_summary
    extra_instructions = params[:extra_instructions].to_s

    new_summary = @article.ai_summary(extra_instructions: extra_instructions)

    @article.update!(summary: new_summary)

    redirect_to request.referrer || conversation_path(@article.conversations.first), notice: "Summary regenerated!"
  end

  def destroy
    @article.destroy
    redirect_to articles_path, notice: "Article deleted"
  end

  private

  def set_article
    @article = current_user.articles.find(params[:id])
  end

  def article_params
    params.require(:article).permit(:link, :summary_prompt_id)
  end
end
