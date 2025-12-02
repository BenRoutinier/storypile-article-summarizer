class CreateSummaryPrompts < ActiveRecord::Migration[7.1]
  def change
    create_table :summary_prompts do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name
      t.text :content

      t.timestamps
    end
  end
end
