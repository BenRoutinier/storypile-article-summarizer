require 'open-uri'

class ArticlesController < ApplicationController
  before_action :set_article, only: [:show, :destroy, :edit, :update]

  def index
    @articles = current_user.articles.all
  end

  def show
    #set_article
  end

  def new
    @article = current_user.articles.new
  end

  def create
    @article = Article.new(article_params)
    @article.user = current_user

    article_html = URI.open(@article.link).read

    @article.set_headline_from_html(article_html)
    @article.set_body_from_html(article_html)
    @article.summary = @article.naive_summary
    @conversation = Conversation.new
    @conversation.title = @article.headline
    @conversation.article = @article

    if @article.save && @conversation.save
      redirect_to conversation_path(@conversation)
    else
      @articles = Article.all
      render "articles/index", status: :unprocessable_entity
    end
  end

  def edit
    #set_article
  end

  def update
    #set_article
    if @article.update(article_params)
      redirect_to article_path(@article), notice: "Article updated"
    else
      render :edit, status: :unprocessable_entity
    end
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
    params.require(:article).permit(:link)
  end
end
