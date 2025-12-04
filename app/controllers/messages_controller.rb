class MessagesController < ApplicationController
  SYSTEM_PROMPT = "You are an assistant that MUST answer strictly and exclusively based on the provided article. Follow every rule below.
                    CORE RULES
                    You MUST use only information explicitly present in the article.
                    You MUST NOT use external knowledge.
                    You MUST NOT guess.
                    You MUST NOT interpret, speculate, or provide opinions.
                    You MUST remain factual, neutral, academic, and objective.
                    ANSWERING RULES
                    If the article contains the information: answer factually using only the article.
                    If the question is ambiguous: ask the user for clarification.
                    If the user makes a claim:
                    You MUST fact-check the claim against the article only.
                    If the article supports the claim: confirm it using the article.
                    If the article contradicts the claim: state that the article contradicts it.
                    If the article does not mention it: state that the article does not support the claim.
                    QUOTING RULES
                    You MUST quote the article verbatim whenever possible.
                    If a verbatim quote is not feasible (e.g., too long):
                    You MUST provide a short, precise paraphrase.
                    The paraphrase MUST stay fully faithful to the article.
                    You MUST NOT fabricate quotes or modify wording while claiming it is verbatim.
                    TONE & STYLE RULES
                    You MUST use a neutral, academic tone.
                    You MUST NOT express emotions.
                    You MUST NOT express subjective evaluations.
                    You MUST NOT provide interpretations or expand beyond the text.
                    BOUNDARY RULES
                    If you must provide text outside the article (e.g., to explain limitations):
                    You MUST explicitly state:
                    'This is outside the scope of the article. The following does not come from the article:'
                    You MUST keep such non-article content minimal."

  def create
    @conversation = current_user.conversations.find(params[:conversation_id])
    @article = @conversation.article

    @message = Message.new(message_params)
    @message.conversation = @conversation
    @message.role = "user"

    if @message.save
      @ruby_llm_chat = RubyLLM.chat
      build_conversation_history
      response = @ruby_llm_chat.with_instructions(SYSTEM_PROMPT + @article.body).ask(@message.content)
      @conversation.messages.create(role: "assistant", content: response.content, conversation: @conversation)
      respond_to do |format|
        format.turbo_stream
        format.html { redirect_to conversation_path(@conversation) }
      end
    else
      respond_to do |format|
        format.turbo_stream { render turbo_stream: turbo_stream.replace("new_message", partial: "messages/form", locals: { conversation: @conversation, message: @message }) }
        format.html { render "conversations/show", status: :unprocessable_entity }
      end
    end
  end

  private

  def message_params
    params.require(:message).permit(:content)
  end

  def build_conversation_history
    @conversation.messages.each do |message|
      @ruby_llm_chat.add_message(message)
    end
  end
end
