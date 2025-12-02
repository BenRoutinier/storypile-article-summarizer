class SummaryPrompt < ApplicationRecord
  belongs_to :user
  has_many :articles

  validates :name, presence: true, uniqueness: true
  validates :content, presence: true
end
