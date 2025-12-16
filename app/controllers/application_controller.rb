class ApplicationController < ActionController::Base
  before_action :authenticate_user!

  def after_sign_in_path_for(resource)
    flash.delete(:notice) # remove Devise's default successful login message
    articles_path
  end
end
