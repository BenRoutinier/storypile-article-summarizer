class Curation < ApplicationRecord
  has_many :bookmarks, dependent: :destroy
  has_many :articles, through: :bookmarks
  belongs_to :user

  validates :title, presence: true, uniqueness: { scope: :user_id }
end
