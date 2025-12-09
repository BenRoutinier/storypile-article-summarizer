class CreateCurations < ActiveRecord::Migration[7.1]
  def change
    create_table :curations do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title

      t.timestamps
    end
  end
end
