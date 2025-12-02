class SummaryPromptsController < ApplicationController
  def index
    @summary_prompts = current_user.summary_prompts.all
  end

  def new
    @summary_prompt = SummaryPrompt.new
  end

  def create
    @summary_prompt = SummaryPrompt.new(summary_prompt_params)
    @summary_prompt.user = current_user
    if @summary_prompt.save
      redirect_to summary_prompts_path
    else
      render :new, status: :unprocessable_entity
    end
  end

  def destroy
    @summary_prompt = current_user.summary_prompts.find(params[:id])
    @summary_prompt.destroy
    redirect_to summary_prompts_path, status: :see_other
  end

  private

  def summary_prompt_params
    params.require(:summary_prompt).permit(:name, :content)
  end
end
