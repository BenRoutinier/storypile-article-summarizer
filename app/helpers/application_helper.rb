module ApplicationHelper
  def current_section_label
    return "My Articles" if current_page?(articles_path)
    return "My Summary Prompts" if current_page?(summary_prompts_path)
    return "My Curations" if current_page?(curations_path)
    return "Favourites" if current_page?(favourites_articles_path)
    return "Archived" if current_page?(archived_articles_path)

    "Navigate"
  end

  def default_meta
    DEFAULT_META
  rescue NameError
    YAML.load_file(Rails.root.join("config/meta.yml"))
  end
end
