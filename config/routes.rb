Rails.application.routes.draw do
  devise_for :users
  root to: "pages#home"
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"

  resources :articles, except: [:new, :edit, :update] do
    resources :bookmarks, only: [:create]

    member do
      patch :archive
      patch :favourite
      patch :update_summary_prompt
      patch :update_tags
      post :regenerate_summary
    end

    collection do
      get :archived
      get :favourites
      get :search
    end
  end

  resources :bookmarks, only: [:create,:destroy]

  resources :summary_prompts, only: [:index, :create, :destroy, :update]

  resources :conversations, only: [:show] do
    resources :messages, only: [:create]
  end

  resources :curations, only: [:index, :show, :create, :destroy, :update]

  get 'tags/:tag', to: 'tags#show', as: :tag
end
