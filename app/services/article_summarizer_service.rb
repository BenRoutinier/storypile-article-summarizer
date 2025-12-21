class ArticleSummarizerService
  def initialize(article, extra_instructions: "")
    @article = article
    @extra_instructions = extra_instructions
  end

  def call
    ai_prompt = <<~PROMPT
      You are a professional media office assistant creating a news overview
      for an exclusive client. Summarize the most important parts of the
      following text for the client. Create a nutgraf in the style of the
      associated press giving an overview of the whole story. Return the
      text of your summary with no subheadings.
      CORE RULES
      You MUST use only information explicitly present in the article.
      You MUST NOT use external knowledge.
      You MUST NOT guess.
      You MUST NOT interpret, speculate, or provide opinions.
    PROMPT

    prompt = <<~FINALPROMPT
      #{ai_prompt}

      #{custom_instructions}

      #{@extra_instructions.present? ? "Additional one-time instructions: #{@extra_instructions}" : ''}
    FINALPROMPT

    begin
      response = RubyLLM.chat.with_instructions(prompt).ask(@article.body).content

      if response.blank?
        "Summary could not be generated at this time."
      else
        response
      end
    rescue StandardError => e
      Rails.logger.error("Summary generation failed: #{e.message}")
      "Summary could not be generated at this time."
    end
  end

  private

  def custom_instructions
    if @article.summary_prompt_id
      prompt = SummaryPrompt.find(@article.summary_prompt_id)
      "Also follow these custom instructions: #{prompt.content}"
    else
      ""
    end
  rescue ActiveRecord::RecordNotFound
    ""
  end
end
