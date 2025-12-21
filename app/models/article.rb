class Article < ApplicationRecord
  include PgSearch::Model

  belongs_to :user
  belongs_to :summary_prompt, optional: true
  has_many :conversations, dependent: :destroy
  has_many :bookmarks, dependent: :destroy
  has_many :curations, through: :bookmarks

  attr_accessor :curation_id

  enum status: { pending: 0, processing: 1, completed: 2, failed: 3 }

  validates :link,
            presence: true,
            uniqueness: { scope: :user_id },
            format: {
              with: URI::DEFAULT_PARSER.make_regexp(%w[http https]),
              message: "must be a valid URL"
            }

  before_validation :normalize_tags

  after_create_commit do
    process_async
    broadcast_prepend_to user, "articles", target: "articles_grid", partial: "articles/article_item", locals: { article: self }
  end

  after_update_commit do
    broadcast_replace_to user, "articles", target: "#{self.class.name.underscore}_#{self.id}_item", partial: "articles/article_item", locals: { article: self }
  end

  after_destroy_commit do
    broadcast_remove_to user, "articles", target: "#{self.class.name.underscore}_#{self.id}_item"
  end

  pg_search_scope :search_fulltext,
                  against: [:headline, :subheadline, :body, :summary, :tags],
                  using: {
                    tsearch: { prefix: true }
                  }

  scope :with_tag, ->(tag) {
    return none if tag.blank?

    sanitized_tag = tag.strip.downcase

    where(
      "LOWER(tags) = :exact OR
       LOWER(tags) LIKE :start OR
       LOWER(tags) LIKE :end OR
       LOWER(tags) LIKE :middle",
      exact: sanitized_tag,
      start: "#{sanitized_tag},%",
      end: "%,#{sanitized_tag}",
      middle: "%,#{sanitized_tag},%"
      )
  }

  scope :archived_status, ->(status) {
    return all if status.blank?
    where(archived: status == 'true')
  }

  scope :favourited_status, ->(status) {
    return all if status.blank?
    where(favourited: status == 'true')
  }

  scope :in_curation, ->(curation_id) {
    return all if curation_id.blank?
    joins(:bookmarks).where(bookmarks: { curation_id: curation_id })
  }

  scope :created_after, ->(date) {
    return all if date.blank?
    where('created_at >= ?', date)
  }

  scope :created_before, ->(date) {
    return all if date.blank?
    where('created_at <= ?', date)
  }

  def self.tag_exists?(user, tag)
    user.articles.with_tag(tag).exists?
  end

  private

  def normalize_tags
    return if tags.blank?
    self.tags = tags.split(',').map(&:strip).reject(&:empty?).join(',')
  end

  def process_async
    ProcessArticleJob.perform_later(self.id)
  end
end
