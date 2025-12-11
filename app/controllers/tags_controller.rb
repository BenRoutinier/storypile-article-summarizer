class TagsController < ApplicationController
  def show
    @tag = params[:tag]

    if Article.tag_exists?(current_user, @tag)
      @articles = current_user.articles.with_tag(@tag).order(created_at: :desc)
    else
      @articles = Article.none
    end
  end
end
