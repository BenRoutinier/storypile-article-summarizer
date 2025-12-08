class Conversation < ApplicationRecord
  belongs_to :article
  has_many :messages, dependent: :destroy

  validates :title, presence: true
end
