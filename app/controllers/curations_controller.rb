class CurationsController < ApplicationController
  before_action :set_curation, only: [:show, :destroy, :update]

  def index
    @curations = current_user.curations.order(created_at: :desc)
  end

  def show
    @articles = @curation.articles.order(created_at: :desc)
  end

  def create
    @curation = current_user.curations.build(curation_params)


    if @curation.save
      redirect_to curations_path, notice: "Curation #{:title} created"
    else
      @curations = current_user.curations
      render :index, status: :unprocessable_entity
    end
  end

  def update
    if @curation.update(curation_params)
      redirect_to curations_path, notice: "Curation renamed."
    else
      render :show, status: :unprocessable_entity
    end
  end

  def destroy
    title = @curation.title
    @curation.destroy
    redirect_to curations_path, notice: "Curation #{:title} deleted"
  end

  private

  def set_curation
    @curation = current_user.curations.find(params[:id])
  end

  def curation_params
    params.require(:curation).permit(:title)
  end

end
