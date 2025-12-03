class ConversationsController < ApplicationController
  def show
    @conversation = current_user.conversations.find(params[:id])
    @message = Message.new
  end
end
