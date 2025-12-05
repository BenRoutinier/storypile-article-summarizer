Rails.application.routes.draw do
  devise_for :users
  root to: "articles#index"
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"

  resources :articles, except: [:new, :edit, :update] do
    post :regenerate_summary, on: :member
  end
  resources :summary_prompts, only: [:index, :create, :destroy]
  resources :conversations, only: [:show] do
    resources :messages, only: [:create]
  end

end
