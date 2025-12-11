module ApplicationHelper
  def current_section_label
    return "My Articles" if current_page?(root_path)
    return "My Summary Prompts" if current_page?(summary_prompts_path)
    return "My Curations" if current_page?(curations_path)
    return "Favourites" if current_page?(favourites_articles_path)
    return "Archived" if current_page?(archived_articles_path)

    "Navigate"
  end
end
