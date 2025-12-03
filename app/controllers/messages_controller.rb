class MessagesController < ApplicationController
  SYSTEM_PROMPT = "You are an assistant that MUST answer strictly and exclusively based on the provided article. Follow every rule below."

  def create
    @conversation = current_user.conversations.find(params[:conversation_id])
    @article = @conversation.article

    @message = Message.new(message_params)
    @message.conversation = @conversation
    @message.role = "user"

    if @message.save
      # ruby_llm_chat = RubyLLM.chat
      # response = ruby_llm_chat.with_instructions(SYSTEM_PROMPT).ask(@message.content)
      Message.create(role: "assistant", content: "I am a ChatBot. I am still in development and cannot answer.", conversation: @conversation)
      redirect_to conversation_path(@conversation)
    else
      render "conversations/show", status: :unprocessable_entity
    end
  end

  private
  def message_params
    params.require(:message).permit(:content)
  end

end
