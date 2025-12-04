class SummaryPrompt < ApplicationRecord
  belongs_to :user
  has_many :articles

  validates :name, presence: true, uniqueness: { scope: :user_id }
  validates :content, presence: true
end
