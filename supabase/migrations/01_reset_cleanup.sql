-- 既存オブジェクトを安全に削除
-- 依存関係の逆順で削除する
DROP TABLE  IF EXISTS feed_item_tags         CASCADE;
DROP TABLE  IF EXISTS user_subscription_tags CASCADE;
DROP TABLE  IF EXISTS tags                   CASCADE;
DROP TABLE  IF EXISTS feed_item_favorites    CASCADE;
DROP TABLE  IF EXISTS feed_items             CASCADE;
DROP TABLE  IF EXISTS user_subscriptions     CASCADE;
DROP TABLE  IF EXISTS user_settings          CASCADE;
DROP TABLE  IF EXISTS users                  CASCADE;
DROP TYPE   IF EXISTS refresh_interval_enum  CASCADE;