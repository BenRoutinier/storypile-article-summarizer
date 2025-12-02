class Article < ApplicationRecord
  belongs_to :user
  belongs_to :summary_prompt, optional: true
  has_many :conversations, dependent: :destroy
  validates :link, presence: true, uniqueness: true
end
