class CreateBookmarks < ActiveRecord::Migration[7.1]
  def change
    create_table :bookmarks do |t|
      t.references :article, null: false, foreign_key: true
      t.references :curation, null: false, foreign_key: true

      t.timestamps
    end
  end
end
