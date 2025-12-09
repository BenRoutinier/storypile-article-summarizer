class BookmarksController < ApplicationController

  before_action: :set_bookmark, only: [:destroy]

  def create
    @bookmark = Bookmark.new(bookmark_params)

    if @bookmark.save
      redirect_to curation_path(@bookmark.curation_id), notice: "Article added to the list."
    else
      redirect_back fallback_location: curations_path, alert: "Could not add article."
    end
  end

  def destroy
    curation = @bookmark.curation
    @bookmark.destroy
    redirect_to curation_path(curation), notice: "Article deleted from the curation"
  end

  private

  def set_bookmark
    @bookmark = Bookmark.find(params[:id])
  end

  def bookmark_params
    params.require(:bookmark).permit(:article_id, :curation_id)
  end

end
