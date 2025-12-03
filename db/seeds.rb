# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end
user = User.create( { email: "fake@fake.com", password: "123456" } )
user_id = user.id
summary = SummaryPrompt.create({ user_id: user_id, name: "Animal stories", content: "Return a list of animals in the article"} )
summary_id = summary.id
Article.create( { user: user, summary_prompt_id: summary_id, link: "https://www.bbc.com/news/articles/cy8jnxxm70jo" } )
summary = SummaryPrompt.create({ user_id: user_id, name: "Sport stories", content: "Begin your response with the match results"} )
summary_id = summary.id
Article.create( { user: user, summary_prompt_id: summary_id, link: "https://www.bbc.com/sport/football/articles/ce8nxpe08g2o"} )
