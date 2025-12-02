class CreateArticles < ActiveRecord::Migration[7.1]
  def change
    create_table :articles do |t|
      t.references :user, null: false, foreign_key: true
      t.references :summary_prompt, null: true, foreign_key: true
      t.string :link
      t.text :headline
      t.text :body
      t.text :summary

      t.timestamps
    end
  end
end
