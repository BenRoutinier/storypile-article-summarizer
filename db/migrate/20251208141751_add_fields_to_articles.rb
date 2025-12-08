class AddFieldsToArticles < ActiveRecord::Migration[7.1]
  def change
    add_column :articles, :tags, :text
    add_column :articles, :subheadline, :text
    add_column :articles, :image_link, :string
    add_column :articles, :archived, :boolean, default: false
    add_column :articles, :favourited, :boolean, default: false
  end
end
