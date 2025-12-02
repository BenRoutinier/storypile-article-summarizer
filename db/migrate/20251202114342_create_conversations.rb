class CreateConversations < ActiveRecord::Migration[7.1]
  def change
    create_table :conversations do |t|
      t.references :article, null: false, foreign_key: true
      t.text :title

      t.timestamps
    end
  end
end
